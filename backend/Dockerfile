# Stage 1: Build & Restore
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /source

# Copy solution and csproj files for optimal layer caching
COPY CourseDeveloper.sln .
COPY src/CourseDeveloper.Core/CourseDeveloper.Core.csproj src/CourseDeveloper.Core/
COPY src/CourseDeveloper.Infrastructure/CourseDeveloper.Infrastructure.csproj src/CourseDeveloper.Infrastructure/
COPY src/CourseDeveloper.Api/CourseDeveloper.Api.csproj src/CourseDeveloper.Api/
COPY tests/CourseDeveloper.UnitTests/CourseDeveloper.UnitTests.csproj tests/CourseDeveloper.UnitTests/

# Restore dependencies
RUN dotnet restore src/CourseDeveloper.Api/CourseDeveloper.Api.csproj

# Copy all source files
COPY src/ src/

# Build and publish release output
WORKDIR /source/src/CourseDeveloper.Api
RUN dotnet publish -c Release -o /app/publish --no-restore

# Stage 2: Runtime Image
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

# Configure ASP.NET Core environment for container
ENV ASPNETCORE_URLS=http://+:5000 \
    ASPNETCORE_ENVIRONMENT=Production \
    ENABLE_SWAGGER=true

# Copy published binaries
COPY --from=build /app/publish .

# Create vault and template directories
RUN mkdir -p /app/vaults /app/obsidian-vault-template

EXPOSE 5000

ENTRYPOINT ["dotnet", "CourseDeveloper.Api.dll"]
