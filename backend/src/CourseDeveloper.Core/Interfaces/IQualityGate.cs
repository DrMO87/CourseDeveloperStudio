namespace CourseDeveloper.Core.Interfaces;

using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Models;

public record GateContext(Organization Organization, string LearnerText, List<SessionAsset> MappedAssets);

public interface IQualityGate
{
    string Code { get; }
    Task<GateResult> EvaluateAsync(GateContext context, Dictionary<string, object> config);
}

public sealed class QualityGateConfigurationException : InvalidOperationException
{
    public QualityGateConfigurationException(string message) : base(message)
    {
    }
}
