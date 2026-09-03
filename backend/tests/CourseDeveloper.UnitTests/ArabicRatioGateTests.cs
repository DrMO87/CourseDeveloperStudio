namespace CourseDeveloper.UnitTests;

using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Models;
using CourseDeveloper.Infrastructure.QualityGates;
using Xunit;

public class LanguageRatioGateTests
{
    private readonly LanguageRatioGate _gate = new();
    private readonly LanguagePolicy _policy = new()
    {
        PrimaryScript = "arabic",
        TargetRatio = 0.70,
        Tolerance = 0.10,
        SecondaryScript = "latin"
    };

    [Fact]
    public void Evaluates_Seventy_Percent_Arabic_As_Pass()
    {
        // 70 Arabic letters, 30 English letters
        string arabic = "هذا نص عربي طويل ومفيد جدا للطلاب في جلسة تعليم الروبوتات والبرمجة والتطوير";
        string english = "EV3 Force Sensor Gyro Motor";
        string text = $"{arabic} {english}";

        var result = _gate.Evaluate(text, _policy);
        Assert.Equal(GateVerdict.PASS, result.Verdict);
    }

    [Fact]
    public void Fails_When_All_English()
    {
        string text = "This is completely English text without any Arabic explanation for students.";
        var result = _gate.Evaluate(text, _policy);
        Assert.Equal(GateVerdict.FAIL, result.Verdict);
    }

    [Fact]
    public void Returns_Unverified_On_Empty_Text()
    {
        var result = _gate.Evaluate("", _policy);
        Assert.Equal(GateVerdict.UNVERIFIED, result.Verdict);
    }
}
