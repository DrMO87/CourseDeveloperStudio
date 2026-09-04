namespace CourseDeveloper.UnitTests;

using CourseDeveloper.Core.Enums;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using CourseDeveloper.Infrastructure.QualityGates;
using Xunit;

public class GateRunnerServiceTests
{
    [Fact]
    public async Task EnabledGatesPopulateReceiptWithMatchingReceiptIdsAndPolicyMetadata()
    {
        var organization = CreateOrganization();
        var definitions = CreateDefinitions(organization.Id);
        var runner = CreateRunner(organization, definitions);

        var receipt = await runner.EvaluateAsync(
            organization.Id,
            Guid.NewGuid(),
            Guid.NewGuid(),
            PipelineStage.ARTIFACTS,
            "مرحبا hello #FF0000 **Asset:** `missing-asset` [INSTRUCTOR NOTE]",
            new List<SessionAsset>());

        Assert.Equal(4, receipt.GateResults.Count);
        Assert.All(receipt.GateResults, gateResult =>
        {
            Assert.Equal(receipt.Id, gateResult.ReceiptId);
            Assert.Equal("blocking", gateResult.Evidence["severity"]);
        });
        Assert.Contains(receipt.GateResults, gateResult => gateResult.GateCode == "language_ratio");
        Assert.Contains(receipt.GateResults, gateResult => gateResult.GateCode == "boundary_check");
        Assert.Contains(receipt.GateResults, gateResult => gateResult.GateCode == "brand_palette");
        Assert.Contains(receipt.GateResults, gateResult => gateResult.GateCode == "asset_reconciliation");
        Assert.NotNull(receipt.GateResults.Single(gateResult => gateResult.GateCode == "language_ratio").MetricValue);
        Assert.All(
            receipt.GateResults.Where(gateResult => gateResult.Verdict == GateVerdict.FAIL),
            gateResult =>
            {
                Assert.False(string.IsNullOrWhiteSpace(gateResult.Evidence["reason"].ToString()));
                Assert.False(string.IsNullOrWhiteSpace(gateResult.Evidence["remedy"].ToString()));
            });
        var boundaryResult = Assert.Single(
            receipt.GateResults,
            gateResult => gateResult.GateCode == "boundary_check");
        Assert.Equal(
            "Remove the listed lecturer-only markers from learner-facing content.",
            boundaryResult.Evidence["remedy"]);
    }

    [Fact]
    public async Task GateCodesAreMatchedWithoutCaseSensitivity()
    {
        var organization = CreateOrganization();
        var definitions = new List<QualityGateDefinition>
        {
            CreateDefinition(organization.Id, "LANGUAGE_RATIO")
        };
        var runner = CreateRunner(organization, definitions);

        var receipt = await runner.EvaluateAsync(
            organization.Id,
            Guid.NewGuid(),
            Guid.NewGuid(),
            PipelineStage.DIGEST,
            "مرحبا hello",
            new List<SessionAsset>());

        Assert.Single(receipt.GateResults);
        Assert.Equal("LANGUAGE_RATIO", receipt.GateResults[0].GateCode);
    }

    [Fact]
    public async Task UnknownEnabledGateThrowsVisibleConfigurationError()
    {
        var organization = CreateOrganization();
        var definitions = new List<QualityGateDefinition>
        {
            CreateDefinition(organization.Id, "missing_gate")
        };
        var runner = CreateRunner(organization, definitions);

        var exception = await Assert.ThrowsAsync<QualityGateConfigurationException>(() => runner.EvaluateAsync(
            organization.Id,
            Guid.NewGuid(),
            Guid.NewGuid(),
            PipelineStage.DIGEST,
            "content",
            new List<SessionAsset>()));

        Assert.Contains("missing_gate", exception.Message);
    }

    [Fact]
    public async Task AdvisoryFailureDoesNotBlockTheOverallReceipt()
    {
        var organization = CreateOrganization();
        var definition = CreateDefinition(organization.Id, "boundary_check");
        definition.GateConfig["severity"] = "advisory";
        var runner = CreateRunner(organization, new List<QualityGateDefinition> { definition });

        var receipt = await runner.EvaluateAsync(
            organization.Id,
            Guid.NewGuid(),
            Guid.NewGuid(),
            PipelineStage.DIGEST,
            "[INSTRUCTOR NOTE]",
            new List<SessionAsset>());

        Assert.Equal(GateVerdict.FAIL, receipt.GateResults[0].Verdict);
        Assert.Equal("advisory", receipt.GateResults[0].Evidence["severity"]);
        Assert.Equal(GateVerdict.PASS, receipt.OverallVerdict);
    }

    private static GateRunnerService CreateRunner(
        Organization organization,
        List<QualityGateDefinition> definitions)
    {
        IQualityGate[] gates =
        {
            new LanguageRatioGate(),
            new BoundaryCheckGate(),
            new BrandPaletteGate(),
            new AssetReconciliationGate()
        };

        return new GateRunnerService(
            new FakeGateDefinitionRepository(definitions),
            new FakeOrganizationRepository(organization),
            gates);
    }

    private static Organization CreateOrganization()
    {
        return new Organization
        {
            Id = Guid.NewGuid(),
            LanguagePolicy = new LanguagePolicy { TargetRatio = 0.5, Tolerance = 0.5 },
            BoundaryTerms = new BoundaryTermsConfig
            {
                ForbiddenStrings = new List<string> { "[INSTRUCTOR NOTE]" }
            },
            BrandPalette = new BrandPalette
            {
                Approved = new List<string> { "#FFFFFF" },
                Retired = new List<string> { "#FF0000" }
            }
        };
    }

    private static List<QualityGateDefinition> CreateDefinitions(Guid organizationId)
    {
        return new List<QualityGateDefinition>
        {
            CreateDefinition(organizationId, "language_ratio"),
            CreateDefinition(organizationId, "boundary_check"),
            CreateDefinition(organizationId, "brand_palette"),
            CreateDefinition(organizationId, "asset_reconciliation")
        };
    }

    private static QualityGateDefinition CreateDefinition(Guid organizationId, string gateCode)
    {
        return new QualityGateDefinition
        {
            OrganizationId = organizationId,
            GateCode = gateCode,
            IsEnabled = true,
            GateConfig = new Dictionary<string, object> { ["severity"] = "blocking" }
        };
    }

    private sealed class FakeGateDefinitionRepository : IGateDefinitionRepository
    {
        private readonly List<QualityGateDefinition> _definitions;

        public FakeGateDefinitionRepository(List<QualityGateDefinition> definitions)
        {
            _definitions = definitions;
        }

        public Task<List<QualityGateDefinition>> GetByOrganizationAsync(Guid organizationId)
            => Task.FromResult(_definitions.Where(definition => definition.OrganizationId == organizationId).ToList());

        public Task<QualityGateDefinition> UpsertAsync(QualityGateDefinition definition)
            => throw new NotSupportedException();

        public Task ToggleAsync(Guid definitionId, bool isEnabled)
            => throw new NotSupportedException();

        public Task DeleteAsync(Guid id)
            => throw new NotSupportedException();
    }

    private sealed class FakeOrganizationRepository : IOrganizationRepository
    {
        private readonly Organization _organization;

        public FakeOrganizationRepository(Organization organization)
        {
            _organization = organization;
        }

        public Task<Organization?> GetByIdAsync(Guid id)
            => Task.FromResult(id == _organization.Id ? _organization : null);

        public Task<List<Organization>> GetAllAsync() => throw new NotSupportedException();
        public Task<Organization?> GetBySlugAsync(string slug) => throw new NotSupportedException();
        public Task<Organization> CreateAsync(Organization organization) => throw new NotSupportedException();
        public Task<Organization> UpdateAsync(Organization organization) => throw new NotSupportedException();
        public Task DeleteAsync(Guid id) => throw new NotSupportedException();
    }
}
