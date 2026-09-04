namespace CourseDeveloper.Worker;

using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

public sealed record UploadedArtifact(string Bucket, string StoragePath, string Sha256, long SizeBytes);

public interface IGenerationArtifactStorage
{
    // Returns null when durable storage isn't configured for this worker (e.g. local dev) —
    // callers keep the local receiptPath as the only location in that case. Throws only once
    // storage IS configured and the upload itself fails, so a live run's success is never
    // reported with an artifact nobody but this worker's local disk can retrieve.
    Task<UploadedArtifact?> UploadAsync(Guid jobId, string localFilePath, CancellationToken cancellationToken);
}

// STEP 6: lands generated course artifacts in Supabase Storage — the same Supabase project
// already hosting Postgres and auth — instead of a new object-storage vendor. Talks to
// Storage's plain REST API directly; no supabase-py/C# SDK exists in this repo yet and one
// PUT endpoint isn't worth adding a dependency for.
public sealed class GenerationArtifactStorage : IGenerationArtifactStorage
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<GenerationArtifactStorage> _logger;
    private readonly string? _projectUrl;
    private readonly string? _serviceRoleKey;
    private readonly string _bucket;

    public GenerationArtifactStorage(HttpClient httpClient, ILogger<GenerationArtifactStorage> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _projectUrl = Environment.GetEnvironmentVariable("SUPABASE_PROJECT_URL")?.TrimEnd('/');
        _serviceRoleKey = Environment.GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY");
        _bucket = Environment.GetEnvironmentVariable("GENERATION_ARTIFACT_BUCKET") ?? "course-artifacts";
    }

    public async Task<UploadedArtifact?> UploadAsync(Guid jobId, string localFilePath, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(_projectUrl) || string.IsNullOrEmpty(_serviceRoleKey))
        {
            _logger.LogWarning(
                "SUPABASE_PROJECT_URL/SUPABASE_SERVICE_ROLE_KEY not set — job {JobId}'s artifact stays only at {LocalPath}.",
                jobId, localFilePath);
            return null;
        }

        var bytes = await File.ReadAllBytesAsync(localFilePath, cancellationToken);
        var sha256 = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        var fileName = Path.GetFileName(localFilePath);
        var storagePath = $"{jobId:N}/{fileName}";
        var requestPath = $"{Uri.EscapeDataString(_bucket)}/{jobId:N}/{Uri.EscapeDataString(fileName)}";

        using var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");

        using var request = new HttpRequestMessage(
            HttpMethod.Post, $"{_projectUrl}/storage/v1/object/{requestPath}")
        {
            Content = content,
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _serviceRoleKey);
        request.Headers.Add("apikey", _serviceRoleKey);
        request.Headers.Add("x-upsert", "true");

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException(
                $"Job {jobId}: uploading artifact to Supabase Storage bucket '{_bucket}' failed " +
                $"({(int)response.StatusCode} {response.StatusCode}): {body}");
        }

        return new UploadedArtifact(_bucket, storagePath, sha256, bytes.LongLength);
    }
}
