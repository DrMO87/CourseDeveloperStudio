namespace CourseDeveloper.Core.Models;

using System;
using System.Collections.Generic;

public class GenerationJobEvent
{
    public Guid Id { get; set; }
    public Guid JobId { get; set; }
    public string EventType { get; set; } = string.Empty;
    public Dictionary<string, object> Detail { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}
