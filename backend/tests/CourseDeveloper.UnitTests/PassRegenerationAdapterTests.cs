namespace CourseDeveloper.UnitTests;

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using CourseDeveloper.Core.Models;
using CourseDeveloper.Worker;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

// STEP 11 Phase B, Batch 2: PassRegenerationAdapter shells out to generate_session.py's
// --regenerate-pass flag exactly the way AcademyBrainSubprocessExecutorTests already
// exercises the ordinary generation subprocess — a real fake python script written to a
// temp dir plus the internal test-only constructor, not a mocked Process.
public class PassRegenerationAdapterTests
{
    [Fact]
    public async Task TryRegeneratePassAsync_RegenerationDeclinedExitCode_ReturnsNull_NotThrow()
    {
        var tempDir = Directory.CreateTempSubdirectory("pass-regen-hardstop-");
        try
        {
            var script = Path.Combine(tempDir.FullName, "hardstop.py");
            await File.WriteAllTextAsync(script, "import sys\nsys.exit(3)\n");

            var adapter = new PassRegenerationAdapter(
                NullLogger<PassRegenerationAdapter>.Instance,
                new FakeCredentialResolver("secret"),
                script,
                "python");
            var job = MakeJob(tempDir.FullName, "acct-1");

            var result = await adapter.TryRegeneratePassAsync("lineage-1", "deck-a", job, CancellationToken.None);

            Assert.Null(result);
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    [Fact]
    public async Task TryRegeneratePassAsync_HardStopExitCode_ThrowsNonRetryable()
    {
        var tempDir = Directory.CreateTempSubdirectory("pass-regen-hardstop-");
        try
        {
            var script = Path.Combine(tempDir.FullName, "hardstop.py");
            await File.WriteAllTextAsync(script, "import sys\nsys.exit(2)\n");

            var adapter = new PassRegenerationAdapter(
                NullLogger<PassRegenerationAdapter>.Instance,
                new FakeCredentialResolver("secret"),
                script,
                "python");
            var job = MakeJob(tempDir.FullName, "acct-1");

            await Assert.ThrowsAsync<NonRetryableJobExecutionException>(
                () => adapter.TryRegeneratePassAsync("lineage-1", "deck-a", job, CancellationToken.None));
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    [Fact]
    public async Task TryRegeneratePassAsync_OtherNonZeroExitCode_Throws()
    {
        var tempDir = Directory.CreateTempSubdirectory("pass-regen-crash-");
        try
        {
            var script = Path.Combine(tempDir.FullName, "crash.py");
            await File.WriteAllTextAsync(script, "import sys\nsys.exit(1)\n");

            var adapter = new PassRegenerationAdapter(
                NullLogger<PassRegenerationAdapter>.Instance,
                new FakeCredentialResolver("secret"),
                script,
                "python");
            var job = MakeJob(tempDir.FullName, "acct-1");

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(
                () => adapter.TryRegeneratePassAsync("lineage-1", "deck-a", job, CancellationToken.None));
            Assert.IsNotType<NonRetryableJobExecutionException>(ex);
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    [Fact]
    public async Task TryRegeneratePassAsync_NoCredentialProvisioned_ThrowsNonRetryable_WithoutLaunchingSubprocess()
    {
        var tempDir = Directory.CreateTempSubdirectory("pass-regen-nocred-");
        try
        {
            var script = Path.Combine(tempDir.FullName, "unused.py");
            var sentinel = Path.Combine(tempDir.FullName, "should-not-exist.txt");
            await File.WriteAllTextAsync(script, $"import pathlib\npathlib.Path(r'{sentinel}').write_text('ran')\n");

            var adapter = new PassRegenerationAdapter(
                NullLogger<PassRegenerationAdapter>.Instance,
                new FakeCredentialResolver(null),
                script,
                "python");
            var job = MakeJob(tempDir.FullName, "acct-missing");

            await Assert.ThrowsAsync<NonRetryableJobExecutionException>(
                () => adapter.TryRegeneratePassAsync("lineage-1", "deck-a", job, CancellationToken.None));

            Assert.False(File.Exists(sentinel), "the subprocess must never launch without a resolved credential.");
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    [Fact]
    public async Task TryRegeneratePassAsync_LiveRun_InjectsCredentialAndInvokesRegeneratePassFlag()
    {
        var tempDir = Directory.CreateTempSubdirectory("pass-regen-live-");
        try
        {
            var script = Path.Combine(tempDir.FullName, "echo_args.py");
            var outFile = Path.Combine(tempDir.FullName, "args.out");
            await File.WriteAllTextAsync(
                script,
                "import os, sys, json\n" +
                // Mirrors AcademyBrainSubprocessExecutorTests' convention: the adapter's real
                // arguments are [sessionId, --root, courseVaultRoot, --live, --regenerate-pass,
                // pass] — sys.argv[3] is courseVaultRoot, so pointing courseVaultRoot at this
                // test's own output file lets the fake script write into it without a made-up
                // extra CLI argument the real adapter doesn't send.
                "with open(sys.argv[3], 'w') as f:\n" +
                "    f.write(os.environ.get('NOTEBOOKLM_AUTH_JSON', '') + '|' + ' '.join(sys.argv[1:]))\n" +
                "print('RESULT_JSON:' + json.dumps({'sessionId': 'L1-s1', 'pass': 'deck-a', " +
                "'newArtifactVersion': 42, 'quarantinedFrom': '/quarantine/deck-a-1.pdf'}))\n");

            var resolver = new FakeCredentialResolver("secret-json-blob");
            var adapter = new PassRegenerationAdapter(
                NullLogger<PassRegenerationAdapter>.Instance,
                resolver,
                script,
                "python");
            var job = MakeJob(outFile, "acct-1");

            var result = await adapter.TryRegeneratePassAsync("lineage-1", "deck-a", job, CancellationToken.None);

            Assert.NotNull(result);
            Assert.Equal(42, result!.NewArtifactVersion);
            Assert.Contains("/quarantine/deck-a-1.pdf", result.Description);
            Assert.Equal("acct-1", resolver.LastRequestedAccountKey);

            var written = await File.ReadAllTextAsync(outFile);
            var parts = written.Split('|');
            Assert.Equal("secret-json-blob", parts[0]);
            // sessionId --root <courseVaultRoot> --live --regenerate-pass deck-a
            Assert.Contains("--live", parts[1]);
            Assert.Contains("--regenerate-pass deck-a", parts[1]);
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    [Fact]
    public async Task TryRegeneratePassAsync_RenderedPromptExists_PassesItToRegeneration()
    {
        var tempDir = Directory.CreateTempSubdirectory("pass-regen-prompt-");
        try
        {
            var renderedDir = Path.Combine(tempDir.FullName, "80-generation", "rendered");
            Directory.CreateDirectory(renderedDir);
            var renderedPrompt = Path.Combine(renderedDir, "nblm-student-deck-prompts.L1-s1.md");
            await File.WriteAllTextAsync(renderedPrompt, "rendered prompt");
            var argumentsPath = Path.Combine(tempDir.FullName, "arguments.txt");
            var script = Path.Combine(tempDir.FullName, "echo_args.py");
            await File.WriteAllTextAsync(
                script,
                $"import json, pathlib, sys\npathlib.Path(r'{argumentsPath}').write_text(' '.join(sys.argv[1:]))\n" +
                "print('RESULT_JSON:' + json.dumps({'newArtifactVersion': 42, 'quarantinedFrom': '/quarantine/deck-a.pdf'}))\n");
            var adapter = new PassRegenerationAdapter(
                NullLogger<PassRegenerationAdapter>.Instance,
                new FakeCredentialResolver("secret"), script, "python");

            await adapter.TryRegeneratePassAsync(
                "lineage-1", "deck-a", MakeJob(tempDir.FullName, "acct-1"), CancellationToken.None);

            var arguments = await File.ReadAllTextAsync(argumentsPath);
            Assert.Contains("--prompt-file", arguments);
            Assert.Contains(renderedPrompt, arguments);
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    [Fact]
    public async Task TryRegeneratePassAsync_SuccessWithoutRegenerationEvidence_Throws()
    {
        var tempDir = Directory.CreateTempSubdirectory("pass-regen-missing-evidence-");
        try
        {
            var script = Path.Combine(tempDir.FullName, "no_version.py");
            await File.WriteAllTextAsync(
                script,
                "import json\n" +
                "print('RESULT_JSON:' + json.dumps({'sessionId': 'L1-s1', 'receiptPath': None, 'pedagogy': {}}))\n");

            var adapter = new PassRegenerationAdapter(
                NullLogger<PassRegenerationAdapter>.Instance,
                new FakeCredentialResolver("secret"),
                script,
                "python");
            var job = MakeJob(tempDir.FullName, "acct-1");

            // A RESULT_JSON with no newArtifactVersion/quarantinedFrom means the script did
            // not actually take the regeneration branch — must never be silently treated as
            // a successful regeneration.
            await Assert.ThrowsAsync<InvalidOperationException>(
                () => adapter.TryRegeneratePassAsync("lineage-1", "deck-a", job, CancellationToken.None));
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    [Fact]
    public async Task TryRegeneratePassAsync_ExceedsWallClockLimit_KillsSubprocessAndThrows()
    {
        var tempDir = Directory.CreateTempSubdirectory("pass-regen-wallclock-");
        try
        {
            var script = Path.Combine(tempDir.FullName, "sleeper.py");
            var pidFile = Path.Combine(tempDir.FullName, "process-tree.pids");
            await File.WriteAllTextAsync(
                script,
                "import os, pathlib, subprocess, sys, time\n" +
                "child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(30)'])\n" +
                $"pathlib.Path(r'{pidFile}').write_text(f'{{os.getpid()}},{{child.pid}}')\n" +
                "time.sleep(30)\n");

            var adapter = new PassRegenerationAdapter(
                NullLogger<PassRegenerationAdapter>.Instance,
                new FakeCredentialResolver("secret"),
                script,
                "python",
                wallClockLimit: TimeSpan.FromSeconds(2));
            var job = MakeJob(tempDir.FullName, "acct-1");

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(
                () => adapter.TryRegeneratePassAsync("lineage-1", "deck-a", job, CancellationToken.None));
            Assert.Contains("wall-clock", ex.Message);

            for (var i = 0; i < 100 && !File.Exists(pidFile); i++)
            {
                await Task.Delay(20);
            }
            Assert.True(File.Exists(pidFile), "Python child did not start and publish its PID.");
            var pids = (await File.ReadAllTextAsync(pidFile)).Split(',');
            await Task.Delay(100);
            foreach (var pid in pids)
            {
                Assert.Throws<ArgumentException>(() => Process.GetProcessById(int.Parse(pid)));
            }
        }
        finally
        {
            tempDir.Delete(recursive: true);
        }
    }

    private static GenerationJob MakeJob(string courseVaultRoot, string accountKey)
    {
        return new GenerationJob
        {
            Id = Guid.NewGuid(),
            NotebookLmAccountKey = accountKey,
            Payload = new Dictionary<string, object>
            {
                ["sessionId"] = "L1-s1",
                ["courseVaultRoot"] = courseVaultRoot,
            },
        };
    }

    private sealed class FakeCredentialResolver : CourseDeveloper.Worker.INotebookLmCredentialResolver
    {
        private readonly string? _value;
        public string? LastRequestedAccountKey { get; private set; }
        public FakeCredentialResolver(string? value) => _value = value;

        public Task<string?> ResolveAsync(string accountKey, CancellationToken cancellationToken)
        {
            LastRequestedAccountKey = accountKey;
            return Task.FromResult(_value);
        }
    }
}
