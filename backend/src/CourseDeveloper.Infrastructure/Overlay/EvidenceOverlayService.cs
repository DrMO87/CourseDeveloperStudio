namespace CourseDeveloper.Infrastructure.Overlay;

using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Models;

public class EvidenceOverlayService
{
    private static readonly string DefaultReservedAreaPattern = @"\[Reserved Image Area:\s*([^\]]+?)\s*\]";

    public List<string> FindUnresolvedRegions(string markdown, string? markerPattern = null)
    {
        string pattern = string.IsNullOrWhiteSpace(markerPattern) ? DefaultReservedAreaPattern : markerPattern;
        var regex = new Regex(pattern, RegexOptions.Compiled);
        
        var matches = regex.Matches(markdown);
        var regions = new List<string>();
        foreach (Match match in matches)
        {
            regions.Add(match.Groups[1].Value.Trim());
        }
        return regions;
    }

    public bool VerifyAllRegionsComposited(string exportedText, List<SessionAsset> evidenceAssets, string? markerPattern = null)
    {
        var remainingMarkers = FindUnresolvedRegions(exportedText, markerPattern);
        if (remainingMarkers.Count > 0)
        {
            throw new InvalidOperationException($"Unfilled reserved image regions detected: {string.Join(", ", remainingMarkers)}. Deck is incomplete.");
        }
        return true;
    }
}
