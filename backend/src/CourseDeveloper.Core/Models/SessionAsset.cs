namespace CourseDeveloper.Core.Models;

using System;
using CourseDeveloper.Core.Enums;

public class SessionAsset
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SessionId { get; set; }
    public string AssetId { get; set; } = string.Empty; // e.g. "ev3-l1s4-img01"
    public string DestinationSlide { get; set; } = string.Empty;
    public AssetClass AssetClass { get; set; } = AssetClass.REFERENCE;
    public string FilePath { get; set; } = string.Empty;
    public string? Sha256 { get; set; }
    public string ProductionStatus { get; set; } = "Produced and mapped";
    public bool IsOverlaid { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
