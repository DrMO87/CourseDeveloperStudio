namespace CourseDeveloper.Core.Models;

using System;
using System.Collections.Generic;

public class QualityGateDefinition
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public string GateCode { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public bool IsEnabled { get; set; } = true;
    public Dictionary<string, object> GateConfig { get; set; } = new();
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
}
