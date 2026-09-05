namespace CourseDeveloper.UnitTests;

using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Models;
using CourseDeveloper.Infrastructure.QualityGates;
using Xunit;

public class BoundaryCheckGateTests
{
    private readonly BoundaryCheckGate _gate = new();
    private readonly BoundaryTermsConfig _boundaryTerms = new()
    {
        ForbiddenStrings = new()
        {
            "lecturer note",
            "lecturer script",
            "common mistakes",
            "ملاحظة للمدرب",
            "إجابة متوقعة",
            "دليل المدرب"
        }
    };

    [Fact]
    public void Passes_Clean_Learner_Text()
    {
        string text = "مرحبا بكم في جلسة اليوم! سنقوم ببرمجة حساس القوة ومحرك الروبوت.";
        var result = _gate.Evaluate(text, _boundaryTerms);
        Assert.Equal(GateVerdict.PASS, result.Verdict);
    }

    [Fact]
    public void Fails_When_Lecturer_Notes_Leak()
    {
        string text = "Welcome students. [lecturer note: explain common mistakes with cables for 5 minutes].";
        var result = _gate.Evaluate(text, _boundaryTerms);
        Assert.Equal(GateVerdict.FAIL, result.Verdict);
    }

    [Fact]
    public void Runs_The_Baseline_Check_Even_When_ForbiddenStrings_Is_Empty()
    {
        // STEP 12 bug fix: an empty (or missing) org override must never disable the
        // mandatory TRAINER_MARKERS baseline — this used to report UNVERIFIED instead.
        var emptyTerms = new BoundaryTermsConfig { ForbiddenStrings = new() };

        var clean = _gate.Evaluate("Clean student-facing content with no leakage.", emptyTerms);
        Assert.Equal(GateVerdict.PASS, clean.Verdict);

        var leaked = _gate.Evaluate("Trainer note: 5 minutes for this activity.", emptyTerms);
        Assert.Equal(GateVerdict.FAIL, leaked.Verdict);
    }

    [Fact]
    public void Unions_Organization_Terms_With_The_Baseline_Instead_Of_Replacing_It()
    {
        var terms = new BoundaryTermsConfig { ForbiddenStrings = new() { "confidential faculty memo" } };

        // The org-specific term fires...
        Assert.Equal(GateVerdict.FAIL, _gate.Evaluate("This is a confidential faculty memo.", terms).Verdict);
        // ...and the baseline marker still fires too, proving it wasn't replaced.
        Assert.Equal(GateVerdict.FAIL, _gate.Evaluate("Trainer note: 5 minutes.", terms).Verdict);
    }

    [Fact]
    public void Detects_The_Baseline_Clock_Time_Timeline_Pattern()
    {
        var terms = new BoundaryTermsConfig { ForbiddenStrings = new() };
        var result = _gate.Evaluate("Content.\n\n00:00-00:10 Warm-up and recap.", terms);
        Assert.Equal(GateVerdict.FAIL, result.Verdict);
    }
}

