namespace CourseDeveloper.UnitTests;

using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Text.Json;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using CourseDeveloper.Worker;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

public class AcademyBrainSubprocessExecutorTests
{
    [Fact]
    public void ParseResultJsonLine_ReadsTheLastMatchingLine_LiveRunShape()
    {
        var stdout =
            "L1-s1: 3 assets, 1 reserved as evidence\n" +
            "  deck-a   -> 2 sources, notebook 'nb-1'\n" +
            "\n" +
            "receipt: D:\\vault\\academy-brain\\90-receipts\\L1-s1.production.yaml\n" +
            "Deck is NOT done. Merge the two passes, overlay evidence, then review by eye.\n" +
            "RESULT_JSON:{\"sessionId\":\"L1-s1\",\"receiptPath\":\"D:\\\\vault\\\\academy-brain\\\\90-receipts\\\\L1-s1.production.yaml\",\"pedagogy\":{\"gate\":\"pedagogy-coverage\",\"verdict\":\"PASS\",\"detail\":\"level reaches Create\"}}\n";

        var parsed = AcademyBrainSubprocessExecutor.ParseResultJsonLine(stdout);

        Assert.NotNull(parsed);
        Assert.Equal("D:\\vault\\academy-brain\\90-receipts\\L1-s1.production.yaml", parsed!.ReceiptPath);
        Assert.NotNull(parsed.Pedagogy);
        Assert.Equal("PASS", ((JsonElement)parsed.Pedagogy!["verdict"]).GetString());
    }

    [Fact]
    public void ParseResultJsonLine_DryRunShape_HasNullReceiptAndPedagogySummary()
    {
        var stdout =
            "L1-s1: 3 assets, 1 reserved as evidence\n" +
            "\ndry run — nothing uploaded, no quota spent. Add --live to fire.\n" +
            "RESULT_JSON:{\"sessionId\":\"L1-s1\",\"receiptPath\":null,\"pedagogy\":{\"gate\":\"pedagogy-coverage\",\"verdict\":\"UNVERIFIED\",\"detail\":\"no record\"}}\n";

        var parsed = AcademyBrainSubprocessExecutor.ParseResultJsonLine(stdout);

        Assert.NotNull(parsed);
        Assert.Null(parsed!.ReceiptPath);
        Assert.Equal("UNVERIFIED", ((JsonElement)parsed.Pedagogy["verdict"]).GetString());
    }

    [Fact]
    public void ParseResultJsonLine_NoMarkerLine_Throws()
    {
        Assert.Throws<InvalidOperationException>(
            () => AcademyBrainSubprocessExecutor.ParseResultJsonLine("clean exit without a result\n"));
    }

    [Fact]
    public async Task ExecuteAsync_WorkerShutdown_KillsRunningSubprocess()
    {
        var tempDir = Directory.CreateTempSubdirectory("academy-brain-executor-");
        try
        {
            var script = Path.Combine(tempDir.FullName, "sleeper.py");
            var pidFile = Path.Combine(tempDir.FullName, "child.pid");
            await File.WriteAllTextAsync(
                script,
                "import os, pathlib, sys, time\npathlib.Path(sys.argv[3]).write_text(str(os.getpid()))\ntime.sleep(30)\n");

            var executor = new AcademyBrainSubprocessExecutor(
                NullLogger<AcademyBrainSubprocessExecutor>.Instance,
                script,
                "python",
                "abcdef0",
                TimeSpan.FromMilliseconds(10),
                new FakeNotebookLmCredentialResolver(null),
                new FakeArtifactStorage());
            var job = MakeDryRunJob(pidFile);
            using var stoppingCts = new CancellationTokenSource();
            var execution = executor.ExecuteAsync(job, () => Task.FromResult(false), stoppingCts.Token);
            for (var i = 0; i < 100 && !File.Exists(pidFile); i++)
            {
                await Task.Delay(20);
            }
            Assert.True(File.Exists(pidFile), "Python child did not start and publish its PID.");
            stoppingCts.Cancel();

            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => execution);

            var pid = int.Parse(await File.ReadAllTextAsync(pidFile));
            await Task.Delay(100);
            Assert.Throws<ArgumentException>(() => Process.GetProcessById(pid));
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    private static CourseDeveloper.Core.Models.GenerationJob MakeDryRunJob(string courseRoot) => new()
    {
        Id = Guid.NewGuid(),
        Operation = "academy-brain.generate-session",
        Payload = new Dictionary<string, object>
        {
            ["contractVersion"] = 1,
            ["sessionId"] = "L1-s1",
            ["courseVaultRoot"] = courseRoot,
            ["live"] = false,
        },
    };

    private static CourseDeveloper.Core.Models.GenerationJob MakeLiveJob(string courseVaultRoot, string accountKey) => new()
    {
        Id = Guid.NewGuid(),
        Operation = "academy-brain.generate-session",
        NotebookLmAccountKey = accountKey,
        Payload = new Dictionary<string, object>
        {
            ["contractVersion"] = 1,
            ["sessionId"] = "L1-s1",
            ["courseVaultRoot"] = courseVaultRoot,
            ["live"] = true,
        },
    };

    private sealed class FakeNotebookLmCredentialResolver : INotebookLmCredentialResolver
    {
        private readonly string? _value;
        public string? LastRequestedAccountKey { get; private set; }
        public FakeNotebookLmCredentialResolver(string? value) => _value = value;

        public Task<string?> ResolveAsync(string accountKey, CancellationToken cancellationToken)
        {
            LastRequestedAccountKey = accountKey;
            return Task.FromResult(_value);
        }
    }

    private sealed class FakeArtifactStorage : IGenerationArtifactStorage
    {
        private readonly UploadedArtifact? _result;
        public List<(Guid JobId, string LocalFilePath)> Calls { get; } = new();
        public FakeArtifactStorage(UploadedArtifact? result = null) => _result = result;

        public Task<UploadedArtifact?> UploadAsync(Guid jobId, string localFilePath, CancellationToken cancellationToken)
        {
            Calls.Add((jobId, localFilePath));
            return Task.FromResult(_result);
        }
    }

    [Fact]
    public async Task ExecuteAsync_HardStopExitCode_ThrowsNonRetryable()
    {
        var tempDir = Directory.CreateTempSubdirectory("academy-brain-executor-hardstop-");
        try
        {
            var script = Path.Combine(tempDir.FullName, "hardstop.py");
            await File.WriteAllTextAsync(script, "import sys\nsys.exit(2)\n");

            var executor = new AcademyBrainSubprocessExecutor(
                NullLogger<AcademyBrainSubprocessExecutor>.Instance,
                script,
                "python",
                "abcdef0",
                TimeSpan.FromMilliseconds(10),
                new FakeNotebookLmCredentialResolver(null),
                new FakeArtifactStorage());
            var job = MakeDryRunJob(tempDir.FullName);

            await Assert.ThrowsAsync<NonRetryableJobExecutionException>(
                () => executor.ExecuteAsync(job, () => Task.FromResult(false), CancellationToken.None));
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    [Fact]
    public async Task ExecuteAsync_OtherNonZeroExitCode_ThrowsRetryableException()
    {
        var tempDir = Directory.CreateTempSubdirectory("academy-brain-executor-crash-");
        try
        {
            var script = Path.Combine(tempDir.FullName, "crash.py");
            await File.WriteAllTextAsync(script, "import sys\nsys.exit(1)\n");

            var executor = new AcademyBrainSubprocessExecutor(
                NullLogger<AcademyBrainSubprocessExecutor>.Instance,
                script,
                "python",
                "abcdef0",
                TimeSpan.FromMilliseconds(10),
                new FakeNotebookLmCredentialResolver(null),
                new FakeArtifactStorage());
            var job = MakeDryRunJob(tempDir.FullName);

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(
                () => executor.ExecuteAsync(job, () => Task.FromResult(false), CancellationToken.None));
            Assert.IsNotType<NonRetryableJobExecutionException>(ex);
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    [Fact]
    public async Task ExecuteAsync_LiveRun_InjectsResolvedCredentialAsEnvVar()
    {
        var tempDir = Directory.CreateTempSubdirectory("academy-brain-executor-live-");
        try
        {
            var script = Path.Combine(tempDir.FullName, "echo_env.py");
            var outFile = Path.Combine(tempDir.FullName, "env.out");
            await File.WriteAllTextAsync(
                script,
                "import os, sys, json\n" +
                "with open(sys.argv[3], 'w') as f:\n" +
                "    f.write(os.environ.get('NOTEBOOKLM_AUTH_JSON', ''))\n" +
                "print('RESULT_JSON:' + json.dumps({'sessionId': 'L1-s1', 'receiptPath': None, " +
                "'pedagogy': {'gate': 'pedagogy-coverage', 'verdict': 'UNVERIFIED', 'detail': 'test'}}))\n");

            var resolver = new FakeNotebookLmCredentialResolver("secret-json-blob");
            var executor = new AcademyBrainSubprocessExecutor(
                NullLogger<AcademyBrainSubprocessExecutor>.Instance,
                script,
                "python",
                "abcdef0",
                TimeSpan.FromMilliseconds(10),
                resolver,
                new FakeArtifactStorage());
            var job = MakeLiveJob(outFile, "acct-1");

            var result = await executor.ExecuteAsync(job, () => Task.FromResult(false), CancellationToken.None);

            Assert.False(result.Canceled);
            Assert.Equal("acct-1", resolver.LastRequestedAccountKey);
            Assert.Equal("secret-json-blob", await File.ReadAllTextAsync(outFile));
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    [Fact]
    public async Task ExecuteAsync_LiveRun_NoCredentialProvisioned_ThrowsNonRetryable()
    {
        var tempDir = Directory.CreateTempSubdirectory("academy-brain-executor-nocred-");
        try
        {
            var script = Path.Combine(tempDir.FullName, "unused.py");
            await File.WriteAllTextAsync(script, "import sys\nsys.exit(0)\n");

            var executor = new AcademyBrainSubprocessExecutor(
                NullLogger<AcademyBrainSubprocessExecutor>.Instance,
                script,
                "python",
                "abcdef0",
                TimeSpan.FromMilliseconds(10),
                new FakeNotebookLmCredentialResolver(null),
                new FakeArtifactStorage());
            var job = MakeLiveJob(Path.Combine(tempDir.FullName, "unused.out"), "acct-missing");

            await Assert.ThrowsAsync<NonRetryableJobExecutionException>(
                () => executor.ExecuteAsync(job, () => Task.FromResult(false), CancellationToken.None));
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    [Fact]
    public async Task ExecuteAsync_LiveRunWithReceipt_RecordsArtifactStorageWhenConfigured()
    {
        var tempDir = Directory.CreateTempSubdirectory("academy-brain-executor-artifact-");
        try
        {
            var script = Path.Combine(tempDir.FullName, "make_receipt.py");
            await File.WriteAllTextAsync(
                script,
                "import sys, json, os\n" +
                "receipt = os.path.join(sys.argv[3], 'receipt.yaml')\n" +
                "with open(receipt, 'w') as f:\n" +
                "    f.write('dummy: true\\n')\n" +
                "print('RESULT_JSON:' + json.dumps({'sessionId': 'L1-s1', 'receiptPath': receipt, " +
                "'pedagogy': {'gate': 'pedagogy-coverage', 'verdict': 'PASS', 'detail': 'ok'}}))\n");

            var uploaded = new UploadedArtifact("course-artifacts", "job-id/receipt.yaml", new string('a', 64), 11);
            var executor = new AcademyBrainSubprocessExecutor(
                NullLogger<AcademyBrainSubprocessExecutor>.Instance,
                script,
                "python",
                "abcdef0",
                TimeSpan.FromMilliseconds(10),
                new FakeNotebookLmCredentialResolver("secret-json-blob"),
                new FakeArtifactStorage(uploaded));
            var job = MakeLiveJob(tempDir.FullName, "acct-1");

            var result = await executor.ExecuteAsync(job, () => Task.FromResult(false), CancellationToken.None);

            var stored = Assert.IsType<Dictionary<string, object>>(result.ResultManifest["artifactStorage"]);
            Assert.Equal("course-artifacts", stored["bucket"]);
            Assert.Equal("job-id/receipt.yaml", stored["path"]);
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    [Fact]
    public async Task ExecuteAsync_LiveRunWithCourseBundle_UploadsZippedBundleDirectorySeparatelyFromReceipt()
    {
        var tempDir = Directory.CreateTempSubdirectory("academy-brain-executor-bundle-");
        try
        {
            var bundleDir = Path.Combine(tempDir.FullName, "75-bundle", "L1-s1");
            Directory.CreateDirectory(bundleDir);
            await File.WriteAllTextAsync(Path.Combine(bundleDir, "slide1.png"), "fake-slide-bytes");

            var script = Path.Combine(tempDir.FullName, "make_receipt.py");
            await File.WriteAllTextAsync(
                script,
                "import sys, json, os\n" +
                "receipt = os.path.join(sys.argv[3], 'receipt.yaml')\n" +
                "with open(receipt, 'w') as f:\n" +
                "    f.write('dummy: true\\n')\n" +
                "print('RESULT_JSON:' + json.dumps({'sessionId': 'L1-s1', 'receiptPath': receipt, " +
                "'pedagogy': {'gate': 'pedagogy-coverage', 'verdict': 'PASS', 'detail': 'ok'}}))\n");

            var uploaded = new UploadedArtifact("course-artifacts", "job-id/x", new string('a', 64), 11);
            var artifactStorage = new FakeArtifactStorage(uploaded);
            var executor = new AcademyBrainSubprocessExecutor(
                NullLogger<AcademyBrainSubprocessExecutor>.Instance,
                script,
                "python",
                "abcdef0",
                TimeSpan.FromMilliseconds(10),
                new FakeNotebookLmCredentialResolver("secret-json-blob"),
                artifactStorage);
            var job = MakeLiveJob(tempDir.FullName, "acct-1");

            var result = await executor.ExecuteAsync(job, () => Task.FromResult(false), CancellationToken.None);

            Assert.True(result.ResultManifest.ContainsKey("artifactStorage"));
            Assert.True(result.ResultManifest.ContainsKey("courseBundleStorage"));
            Assert.Equal(2, artifactStorage.Calls.Count);
            Assert.EndsWith("receipt.yaml", artifactStorage.Calls[0].LocalFilePath);
            Assert.EndsWith(".zip", artifactStorage.Calls[1].LocalFilePath);
            Assert.False(File.Exists(artifactStorage.Calls[1].LocalFilePath));
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    // STEP 11 Phase B, Batch 3 follow-up (Codex review): generated PDFs under
    // 80-generation/<sid> were never uploaded (only the small receipt and the pre-generation
    // 75-bundle zip were) — and prompt provenance never reached the manifest at all. Both
    // fixed by extending this executor's existing upload-then-record-in-manifest pattern.
    [Fact]
    public async Task ExecuteAsync_LiveRun_UploadsGeneratedPdfsAndRecordsPromptProvenance()
    {
        var tempDir = Directory.CreateTempSubdirectory("academy-brain-executor-pdf-provenance-");
        try
        {
            var passDir = Path.Combine(tempDir.FullName, "80-generation", "L1-s1");
            Directory.CreateDirectory(passDir);
            await File.WriteAllTextAsync(Path.Combine(passDir, "deck-a.pdf"), "fake-pdf-bytes-a");
            await File.WriteAllTextAsync(Path.Combine(passDir, "summary.pdf"), "fake-pdf-bytes-summary");
            // deck-b.pdf deliberately absent — only passes that actually exist get uploaded.

            var script = Path.Combine(tempDir.FullName, "make_receipt.py");
            await File.WriteAllTextAsync(
                script,
                "import sys, json, os\n" +
                "receipt = os.path.join(sys.argv[3], 'receipt.yaml')\n" +
                "with open(receipt, 'w') as f:\n    f.write('dummy: true\\n')\n" +
                "print('RESULT_JSON:' + json.dumps({'sessionId': 'L1-s1', 'receiptPath': receipt, " +
                "'pedagogy': {'gate': 'pedagogy-coverage', 'verdict': 'PASS', 'detail': 'ok'}, " +
                "'promptProvenance': {'path': 'some/prompt.md', 'sha256': 'deadbeef'}}))\n");

            var uploaded = new UploadedArtifact("course-artifacts", "job-id/x.pdf", new string('a', 64), 42);
            var artifactStorage = new FakeArtifactStorage(uploaded);
            var executor = new AcademyBrainSubprocessExecutor(
                NullLogger<AcademyBrainSubprocessExecutor>.Instance,
                script, "python", "abcdef0", TimeSpan.FromMilliseconds(10),
                new FakeNotebookLmCredentialResolver("secret-json-blob"), artifactStorage);
            var job = MakeLiveJob(tempDir.FullName, "acct-1");

            var result = await executor.ExecuteAsync(job, () => Task.FromResult(false), CancellationToken.None);

            var provenance = Assert.IsType<Dictionary<string, object>>(result.ResultManifest["promptProvenance"]);
            Assert.Equal("deadbeef", ((JsonElement)provenance["sha256"]).GetString());

            var pdfStorage = Assert.IsType<Dictionary<string, object>>(result.ResultManifest["generatedPdfStorage"]);
            Assert.Equal(2, pdfStorage.Count);
            Assert.Contains("deck-a", pdfStorage.Keys);
            Assert.Contains("summary", pdfStorage.Keys);
            Assert.DoesNotContain("deck-b", pdfStorage.Keys);
            Assert.Contains(artifactStorage.Calls, c => c.LocalFilePath.EndsWith("deck-a.pdf"));
            Assert.Contains(artifactStorage.Calls, c => c.LocalFilePath.EndsWith("summary.pdf"));
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    // STEP 11 Phase B, Batch 3 follow-up (Codex review): the internal test-only
    // constructor's default orchestrator must fail loudly, not silently pretend success,
    // if a caller supplies a real reevaluator (one that can find violations) but forgets to
    // also supply a real orchestrator — see ThrowIfReachedContentQualityCascadeOrchestrator's
    // doc comment.
    [Fact]
    public async Task ExecuteAsync_LiveRun_ReevaluatorFindsViolations_NoOrchestratorSupplied_ThrowsLoudly()
    {
        var tempDir = Directory.CreateTempSubdirectory("academy-brain-executor-mismatched-fakes-");
        try
        {
            var script = Path.Combine(tempDir.FullName, "unused.py");
            await File.WriteAllTextAsync(script, "import sys\nsys.exit(0)\n");

            var reevaluator = new FakeGateReevaluator(new List<ContentQualityViolation> { MakeViolation() });
            var executor = new AcademyBrainSubprocessExecutor(
                NullLogger<AcademyBrainSubprocessExecutor>.Instance,
                script, "python", "abcdef0", TimeSpan.FromMilliseconds(10),
                new FakeNotebookLmCredentialResolver("secret-json-blob"), new FakeArtifactStorage(),
                reevaluator); // orchestrator intentionally omitted — defaults to the throwing fallback
            var job = MakeLiveJob(tempDir.FullName, "acct-1");

            await Assert.ThrowsAsync<InvalidOperationException>(
                () => executor.ExecuteAsync(job, () => Task.FromResult(false), CancellationToken.None));
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    // STEP 11 Phase B, Batch 3: the first production call site for the content-quality
    // cascade (Codex's review of Batch 3 found it was built in Batches 1-3 but never
    // actually invoked anywhere). These tests use fakes rather than the real
    // ContentQualityCascadeOrchestrator — that class's own behavior is covered by
    // ContentQualityCascadeTests; these only need to prove this executor calls it at the
    // right two points and honors its outcome.
    [Fact]
    public async Task ExecuteAsync_LiveRun_PreGenerationCascadeExhausted_NeverLaunchesSubprocess()
    {
        var tempDir = Directory.CreateTempSubdirectory("academy-brain-executor-pregen-exhaust-");
        try
        {
            var script = Path.Combine(tempDir.FullName, "marker.py");
            var markerFile = Path.Combine(tempDir.FullName, "launched.marker");
            await File.WriteAllTextAsync(script, $"open(r'{markerFile}', 'w').close()\n");

            var reevaluator = new FakeGateReevaluator(new List<ContentQualityViolation> { MakeViolation() });
            var orchestrator = new FakeCascadeOrchestrator(_ => false);
            var credentialResolver = new FakeNotebookLmCredentialResolver("secret-json-blob");
            var executor = new AcademyBrainSubprocessExecutor(
                NullLogger<AcademyBrainSubprocessExecutor>.Instance,
                script, "python", "abcdef0", TimeSpan.FromMilliseconds(10),
                credentialResolver, new FakeArtifactStorage(), reevaluator, orchestrator);
            var job = MakeLiveJob(tempDir.FullName, "acct-1");

            var result = await executor.ExecuteAsync(job, () => Task.FromResult(false), CancellationToken.None);

            Assert.True(result.QualityCascadeHandled);
            Assert.False(result.Canceled);
            Assert.False(File.Exists(markerFile), "the subprocess must never launch once quota is not spent");
            Assert.Null(credentialResolver.LastRequestedAccountKey);
            Assert.Equal(new[] { (string?)null }, orchestrator.CallsByPass);
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    [Fact]
    public async Task ExecuteAsync_LiveRun_PreGenerationCascadeResolved_PassesRenderedPromptFile_WhenOneExists()
    {
        var tempDir = Directory.CreateTempSubdirectory("academy-brain-executor-pregen-render-");
        try
        {
            var renderedDir = Path.Combine(tempDir.FullName, "80-generation", "rendered");
            Directory.CreateDirectory(renderedDir);
            var renderedPath = Path.Combine(renderedDir, "nblm-student-deck-prompts.L1-s1.md");
            await File.WriteAllTextAsync(renderedPath, "already rendered");

            var argsFile = Path.Combine(tempDir.FullName, "args.out");
            var script = Path.Combine(tempDir.FullName, "echo_args.py");
            await File.WriteAllTextAsync(
                script,
                $"import sys, json\n" +
                $"with open(r'{argsFile}', 'w') as f:\n    f.write(' '.join(sys.argv))\n" +
                "print('RESULT_JSON:' + json.dumps({'sessionId': 'L1-s1', 'receiptPath': None, " +
                "'pedagogy': {'gate': 'pedagogy-coverage', 'verdict': 'UNVERIFIED', 'detail': 'test'}}))\n");

            var reevaluator = new FakeGateReevaluator(new List<ContentQualityViolation>());
            var orchestrator = new FakeCascadeOrchestrator(_ => true);
            var executor = new AcademyBrainSubprocessExecutor(
                NullLogger<AcademyBrainSubprocessExecutor>.Instance,
                script, "python", "abcdef0", TimeSpan.FromMilliseconds(10),
                new FakeNotebookLmCredentialResolver("secret-json-blob"), new FakeArtifactStorage(),
                reevaluator, orchestrator);
            var job = MakeLiveJob(tempDir.FullName, "acct-1");

            var result = await executor.ExecuteAsync(job, () => Task.FromResult(false), CancellationToken.None);

            Assert.False(result.QualityCascadeHandled);
            var capturedArgs = await File.ReadAllTextAsync(argsFile);
            Assert.Contains("--prompt-file", capturedArgs);
            Assert.Contains(renderedPath, capturedArgs);
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    [Fact]
    public async Task ExecuteAsync_LiveRun_NoViolations_DoesNotOverwritePersistedCascadeState()
    {
        var tempDir = Directory.CreateTempSubdirectory("academy-brain-executor-empty-cascade-");
        try
        {
            var script = Path.Combine(tempDir.FullName, "success.py");
            await File.WriteAllTextAsync(
                script,
                "import json\nprint('RESULT_JSON:' + json.dumps({'sessionId': 'L1-s1', 'receiptPath': None, " +
                "'pedagogy': {'gate': 'pedagogy-coverage', 'verdict': 'PASS', 'detail': 'ok'}}))\n");

            var orchestrator = new FakeCascadeOrchestrator(_ => true);
            var executor = new AcademyBrainSubprocessExecutor(
                NullLogger<AcademyBrainSubprocessExecutor>.Instance,
                script, "python", "abcdef0", TimeSpan.FromMilliseconds(10),
                new FakeNotebookLmCredentialResolver("secret-json-blob"), new FakeArtifactStorage(),
                new FakeGateReevaluator(new List<ContentQualityViolation>()), orchestrator);

            var result = await executor.ExecuteAsync(
                MakeLiveJob(tempDir.FullName, "acct-1"), () => Task.FromResult(false), CancellationToken.None);

            Assert.False(result.QualityCascadeHandled);
            Assert.Empty(orchestrator.CallsByPass);
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    [Fact]
    public async Task ExecuteAsync_LiveRun_PostGenerationCascadeExhausted_SkipsUpload_AndReturnsQualityCascadeHandled()
    {
        var tempDir = Directory.CreateTempSubdirectory("academy-brain-executor-postgen-exhaust-");
        try
        {
            var passDir = Path.Combine(tempDir.FullName, "80-generation", "L1-s1");
            Directory.CreateDirectory(passDir);
            await File.WriteAllTextAsync(Path.Combine(passDir, "deck-a.pdf"), "fake-pdf-bytes");

            var script = Path.Combine(tempDir.FullName, "make_receipt.py");
            await File.WriteAllTextAsync(
                script,
                "import sys, json, os\n" +
                "receipt = os.path.join(sys.argv[3], 'receipt.yaml')\n" +
                "with open(receipt, 'w') as f:\n    f.write('dummy: true\\n')\n" +
                "print('RESULT_JSON:' + json.dumps({'sessionId': 'L1-s1', 'receiptPath': receipt, " +
                "'pedagogy': {'gate': 'pedagogy-coverage', 'verdict': 'PASS', 'detail': 'ok'}}))\n");

            var reevaluator = new FakeGateReevaluator(new List<ContentQualityViolation> { MakeViolation(pass: "deck-a") });
            var orchestrator = new FakeCascadeOrchestrator(pass => pass is null); // pre-gen resolves, post-gen (deck-a) exhausts
            var artifactStorage = new FakeArtifactStorage(new UploadedArtifact("bucket", "path", new string('a', 64), 1));
            var executor = new AcademyBrainSubprocessExecutor(
                NullLogger<AcademyBrainSubprocessExecutor>.Instance,
                script, "python", "abcdef0", TimeSpan.FromMilliseconds(10),
                new FakeNotebookLmCredentialResolver("secret-json-blob"), artifactStorage,
                reevaluator, orchestrator);
            var job = MakeLiveJob(tempDir.FullName, "acct-1");

            var result = await executor.ExecuteAsync(job, () => Task.FromResult(false), CancellationToken.None);

            Assert.True(result.QualityCascadeHandled);
            Assert.Empty(artifactStorage.Calls);
            Assert.Contains("deck-a", orchestrator.CallsByPass);
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    private static ContentQualityViolation MakeViolation(string? pass = null) => new()
    {
        Origin = ContentQualityOrigin.AcademyBrainRegistryGate,
        GateCode = "nblm-prompt-preflight",
        ArtifactLineageId = "L1-s1",
        ArtifactVersion = 1,
        Pass = pass,
        Verdict = GateVerdict.FAIL,
        IsBlocking = true,
        Detail = "test violation",
    };

    private sealed class FakeGateReevaluator : IContentQualityGateReevaluator
    {
        private readonly List<ContentQualityViolation> _toReturn;
        public FakeGateReevaluator(List<ContentQualityViolation> toReturn) => _toReturn = toReturn;

        public Task<List<ContentQualityViolation>> ReevaluateAsync(
            GenerationJob job, string artifactLineageId, int artifactVersion, string? pass, CancellationToken ct)
            => Task.FromResult(_toReturn.Where(v => v.Pass == pass).ToList());
    }

    private sealed class FakeCascadeOrchestrator : IContentQualityCascadeOrchestrator
    {
        private readonly Func<string?, bool> _resolvedForPass;
        public List<string?> CallsByPass { get; } = new();
        public FakeCascadeOrchestrator(Func<string?, bool> resolvedForPass) => _resolvedForPass = resolvedForPass;

        public Task<ContentQualityCascadeOutcome> ProcessAsync(
            GenerationJob job, string artifactLineageId, int artifactVersion, string? pass,
            List<ContentQualityViolation> violations, CancellationToken ct)
        {
            CallsByPass.Add(pass);
            var resolved = _resolvedForPass(pass);
            return Task.FromResult(new ContentQualityCascadeOutcome(
                Resolved: resolved, Exhausted: !resolved, RemainingViolations: violations,
                new ContentQualityCascadeState { ArtifactLineageId = artifactLineageId, Pass = pass, CurrentArtifactVersion = artifactVersion }));
        }
    }

    [Fact]
    public void Tail_TruncatesToLastNCharsOnly()
    {
        var text = new string('x', 5000) + "END";
        var tail = AcademyBrainSubprocessExecutor.Tail(text);
        Assert.EndsWith("END", tail);
        Assert.Equal(4000, tail.Length);
    }

    [Fact]
    public void Tail_ShortTextIsReturnedUnchanged()
    {
        Assert.Equal("short", AcademyBrainSubprocessExecutor.Tail("short"));
    }

    // NpgsqlGenerationJobRepository deserializes Payload as Dictionary<string,object> via
    // System.Text.Json, which boxes scalar values as JsonElement, not the native CLR type —
    // these coercion helpers are what let the executor read that shape correctly.
    [Fact]
    public void Coerce_ReadsFromJsonElement_AsProducedByPayloadDeserialization()
    {
        using var doc = JsonDocument.Parse("{\"s\":\"L1-s1\",\"b\":true,\"n\":1}");
        var root = doc.RootElement;

        Assert.Equal("L1-s1", AcademyBrainSubprocessExecutor.CoerceString(root.GetProperty("s")));
        Assert.True(AcademyBrainSubprocessExecutor.CoerceBool(root.GetProperty("b")));
        Assert.Equal(1, AcademyBrainSubprocessExecutor.CoerceInt(root.GetProperty("n")));
    }

    [Fact]
    public void Coerce_ReadsFromNativeClrTypes_ForDirectlyConstructedPayloads()
    {
        Assert.Equal("x", AcademyBrainSubprocessExecutor.CoerceString("x"));
        Assert.True(AcademyBrainSubprocessExecutor.CoerceBool(true));
        Assert.Equal(2, AcademyBrainSubprocessExecutor.CoerceInt(2));
        Assert.Equal(2, AcademyBrainSubprocessExecutor.CoerceInt(2L));
    }
}
