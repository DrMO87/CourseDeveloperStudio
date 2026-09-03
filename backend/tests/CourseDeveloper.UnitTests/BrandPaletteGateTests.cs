namespace CourseDeveloper.UnitTests;

using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Models;
using CourseDeveloper.Infrastructure.QualityGates;
using Xunit;

public class BrandPaletteGateTests
{
    private readonly BrandPaletteGate _gate = new();
    private readonly BrandPalette _palette = new()
    {
        Approved = new() { "#231F20", "#FFED10", "#585858", "#FFFFFF" },
        Retired = new() { "#F5B301", "#1A1A1A" }
    };

    [Fact]
    public void Passes_Approved_Colors()
    {
        string text = "Color styles: background: #231F20; accent: #FFED10; text: #FFFFFF;";
        var result = _gate.Evaluate(text, _palette);
        Assert.Equal(GateVerdict.PASS, result.Verdict);
    }

    [Fact]
    public void Fails_On_Retired_Colors()
    {
        string text = "Theme: #F5B301 with header #1A1A1A";
        var result = _gate.Evaluate(text, _palette);
        Assert.Equal(GateVerdict.FAIL, result.Verdict);
    }
}
