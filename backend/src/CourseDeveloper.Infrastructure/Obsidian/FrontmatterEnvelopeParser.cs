namespace CourseDeveloper.Infrastructure.Obsidian;

using System;
using System.Collections.Generic;
using System.Text;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

public static class FrontmatterEnvelopeParser
{
    private static readonly IDeserializer _deserializer = new DeserializerBuilder()
        .WithNamingConvention(UnderscoredNamingConvention.Instance)
        .IgnoreUnmatchedProperties()
        .Build();

    private static readonly ISerializer _serializer = new SerializerBuilder()
        .WithNamingConvention(UnderscoredNamingConvention.Instance)
        .Build();

    public static (Dictionary<string, object> Frontmatter, string Body) Parse(string rawMarkdown)
    {
        if (string.IsNullOrWhiteSpace(rawMarkdown) || !rawMarkdown.StartsWith("---"))
        {
            return (new Dictionary<string, object>(), rawMarkdown ?? string.Empty);
        }

        var parts = rawMarkdown.Split(new[] { "---" }, 3, StringSplitOptions.None);
        if (parts.Length < 3)
        {
            return (new Dictionary<string, object>(), rawMarkdown);
        }

        var yamlContent = parts[1];
        var bodyContent = parts[2].TrimStart('', '
');

        try
        {
            var dict = _deserializer.Deserialize<Dictionary<string, object>>(yamlContent) ?? new Dictionary<string, object>();
            return (dict, bodyContent);
        }
        catch
        {
            return (new Dictionary<string, object>(), rawMarkdown);
        }
    }

    public static string Serialize(Dictionary<string, object> frontmatter, string body)
    {
        var sb = new StringBuilder();
        sb.AppendLine("---");
        var yaml = _serializer.Serialize(frontmatter);
        sb.Append(yaml);
        sb.AppendLine("---");
        sb.AppendLine();
        sb.Append(body);
        return sb.ToString();
    }
}
