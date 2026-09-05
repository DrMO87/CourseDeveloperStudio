namespace CourseDeveloper.UnitTests;

using System;
using CourseDeveloper.Core.Models;
using Xunit;

public class ContentQualityBackoffScheduleTests
{
    [Theory]
    [InlineData(1, 5)]
    [InlineData(2, 15)]
    [InlineData(3, 60)]
    public void FirstThreeCyclesMatchTheHandoffsExplicitMinuteValues(int cycle, int expectedMinutes)
    {
        Assert.Equal(TimeSpan.FromMinutes(expectedMinutes), ContentQualityBackoffSchedule.DelayForCycle(cycle));
    }

    [Theory]
    [InlineData(4)]
    [InlineData(5)]
    [InlineData(100)]
    public void CyclesPastTheExplicitStepsPlateauAtSixHours(int cycle)
    {
        Assert.Equal(TimeSpan.FromHours(6), ContentQualityBackoffSchedule.DelayForCycle(cycle));
    }

    [Fact]
    public void CycleLessThanOneIsTreatedAsCycleOne()
    {
        Assert.Equal(ContentQualityBackoffSchedule.DelayForCycle(1), ContentQualityBackoffSchedule.DelayForCycle(0));
    }
}
