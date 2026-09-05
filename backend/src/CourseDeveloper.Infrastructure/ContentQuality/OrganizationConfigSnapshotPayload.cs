namespace CourseDeveloper.Infrastructure.ContentQuality;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using CourseDeveloper.Core.Models;

// STEP 12: converts an OrganizationConfigSnapshot to/from GenerationJob.Payload's
// "orgConfigSnapshot" entry (see contracts/org-config/org-config.schema.json). A job
// constructed directly in-process (e.g. a test, or the future enqueue path before the job
// round-trips through Postgres) carries the snapshot as a plain Dictionary<string,object>;
// one read back after NpgsqlGenerationJobRepository deserializes the stored jsonb carries it
// as JsonElement — every read below accepts either, matching the coercion style already used
// throughout this file's siblings (AssetReconciliationSource, AcademyBrainSubprocessExecutor).
public static class OrganizationConfigSnapshotPayload
{
    private const string PayloadKey = "orgConfigSnapshot";

    public static Dictionary<string, object> ToPayloadValue(OrganizationConfigSnapshot snapshot) => new()
    {
        ["schemaVersion"] = snapshot.SchemaVersion,
        ["organizationId"] = snapshot.OrganizationId.ToString(),
        ["brandPalette"] = new Dictionary<string, object>
        {
            ["approved"] = snapshot.BrandPalette.Approved.ToList(),
            ["retired"] = snapshot.BrandPalette.Retired.ToList(),
        },
        ["languagePolicy"] = new Dictionary<string, object>
        {
            ["targetRatio"] = snapshot.LanguagePolicy.TargetRatio,
            ["tolerance"] = snapshot.LanguagePolicy.Tolerance,
        },
        ["boundaryTerms"] = new Dictionary<string, object>
        {
            ["forbiddenStrings"] = snapshot.BoundaryTerms.ForbiddenStrings.ToList(),
        },
        ["nblmPromptFields"] = new Dictionary<string, object>
        {
            ["durationMinutes"] = snapshot.DurationMinutes,
            ["targetAgeBand"] = snapshot.TargetAgeBand,
            ["organizationName"] = snapshot.OrganizationName,
            ["mascotCharacterName"] = snapshot.MascotCharacterName!,
        },
    };

    public static OrganizationConfigSnapshot FromJobPayload(GenerationJob job)
    {
        if (!job.Payload.TryGetValue(PayloadKey, out var raw))
        {
            throw new InvalidOperationException(
                $"Job {job.Id} payload is missing '{PayloadKey}' — this gate/corrector requires the " +
                "enqueue-time organization-config snapshot (see contracts/org-config/org-config.schema.json).");
        }

        var root = ToDict(raw, PayloadKey);
        var schemaVersion = ReadInt(root, "schemaVersion", PayloadKey);
        if (schemaVersion != OrganizationConfigSnapshot.CurrentSchemaVersion)
        {
            throw new InvalidOperationException(
                $"Job {job.Id}: '{PayloadKey}' has schemaVersion {schemaVersion}, but this worker build only " +
                $"understands version {OrganizationConfigSnapshot.CurrentSchemaVersion}.");
        }

        var brandPalette = ToDict(Require(root, "brandPalette", PayloadKey), "brandPalette");
        var languagePolicy = ToDict(Require(root, "languagePolicy", PayloadKey), "languagePolicy");
        var boundaryTerms = ToDict(Require(root, "boundaryTerms", PayloadKey), "boundaryTerms");
        var nblmFields = ToDict(Require(root, "nblmPromptFields", PayloadKey), "nblmPromptFields");

        return new OrganizationConfigSnapshot
        {
            SchemaVersion = schemaVersion,
            OrganizationId = Guid.Parse(ReadString(root, "organizationId", PayloadKey)),
            BrandPalette = new BrandPalette
            {
                Approved = ReadStringList(brandPalette, "approved"),
                Retired = ReadStringList(brandPalette, "retired"),
            },
            LanguagePolicy = new LanguagePolicy
            {
                TargetRatio = ReadDouble(languagePolicy, "targetRatio"),
                Tolerance = ReadDouble(languagePolicy, "tolerance"),
            },
            BoundaryTerms = new BoundaryTermsConfig
            {
                ForbiddenStrings = ReadStringList(boundaryTerms, "forbiddenStrings"),
            },
            DurationMinutes = ReadInt(nblmFields, "durationMinutes", "nblmPromptFields"),
            TargetAgeBand = ReadString(nblmFields, "targetAgeBand", "nblmPromptFields"),
            OrganizationName = ReadString(nblmFields, "organizationName", "nblmPromptFields"),
            MascotCharacterName = ReadNullableString(nblmFields, "mascotCharacterName"),
        };
    }

    private static object Require(Dictionary<string, object> dict, string key, string parentLabel)
        => dict.TryGetValue(key, out var value)
            ? value
            : throw new InvalidOperationException($"'{parentLabel}' is missing '{key}'.");

    private static Dictionary<string, object> ToDict(object value, string label) => value switch
    {
        Dictionary<string, object> dict => dict,
        JsonElement el when el.ValueKind == JsonValueKind.Object =>
            JsonSerializer.Deserialize<Dictionary<string, object>>(el.GetRawText())
                ?? throw new InvalidOperationException($"'{label}' deserialized to null."),
        _ => throw new InvalidOperationException($"'{label}' must be a JSON object."),
    };

    private static string ReadString(Dictionary<string, object> dict, string key, string parentLabel)
        => CoerceString(Require(dict, key, parentLabel))
            ?? throw new InvalidOperationException($"'{parentLabel}.{key}' must be a string.");

    private static string? ReadNullableString(Dictionary<string, object> dict, string key)
    {
        var value = Require(dict, key, "nblmPromptFields");
        var coerced = CoerceString(value);
        if (coerced is null && value is not null && value is not JsonElement { ValueKind: JsonValueKind.Null })
        {
            throw new InvalidOperationException($"'nblmPromptFields.{key}' must be a string or null.");
        }
        return coerced;
    }

    private static int ReadInt(Dictionary<string, object> dict, string key, string parentLabel)
        => CoerceInt(Require(dict, key, parentLabel), parentLabel, key);

    private static double ReadDouble(Dictionary<string, object> dict, string key)
        => Require(dict, key, "languagePolicy") switch
        {
            JsonElement el when el.ValueKind == JsonValueKind.Number => el.GetDouble(),
            double d => d,
            int i => i,
            _ => throw new InvalidOperationException($"'languagePolicy.{key}' must be a number."),
        };

    private static List<string> ReadStringList(Dictionary<string, object> dict, string key)
    {
        var value = Require(dict, key, key is "approved" or "retired" ? "brandPalette" : "boundaryTerms");

        return value switch
        {
            List<string> list => new(list),
            IEnumerable<object> objs => objs.Select(o => CoerceRequiredString(o, key)).ToList(),
            JsonElement el when el.ValueKind == JsonValueKind.Array =>
                el.EnumerateArray().Select(e => CoerceRequiredString(e, key)).ToList(),
            _ => throw new InvalidOperationException($"'{key}' must be an array of strings."),
        };
    }

    private static string CoerceRequiredString(object value, string key)
        => CoerceString(value)
            ?? throw new InvalidOperationException($"'{key}' must contain only strings.");

    private static string? CoerceString(object value) => value switch
    {
        JsonElement el when el.ValueKind == JsonValueKind.String => el.GetString(),
        JsonElement el when el.ValueKind == JsonValueKind.Null => null,
        string s => s,
        null => null,
        _ => null,
    };

    private static int CoerceInt(object value, string parentLabel, string key) => value switch
    {
        JsonElement el when el.ValueKind == JsonValueKind.Number => el.GetInt32(),
        int i => i,
        long l => (int)l,
        double d => (int)d,
        _ => throw new InvalidOperationException($"'{parentLabel}.{key}' must be a number."),
    };
}
