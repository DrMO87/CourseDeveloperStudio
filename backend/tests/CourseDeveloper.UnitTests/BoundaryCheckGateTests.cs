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
}

