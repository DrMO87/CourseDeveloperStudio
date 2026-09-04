namespace CourseDeveloper.UnitTests;

using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Text.Json;
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
                TimeSpan.FromMilliseconds(10));
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
                TimeSpan.FromMilliseconds(10));
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
                TimeSpan.FromMilliseconds(10));
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
