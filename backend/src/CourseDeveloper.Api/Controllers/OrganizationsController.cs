namespace CourseDeveloper.Api.Controllers;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CourseDeveloper.Core.Interfaces;
using CourseDeveloper.Core.Models;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class OrganizationsController : ControllerBase
{
    private readonly IOrganizationRepository _organizationRepo;
    private readonly IGateDefinitionRepository _gateDefinitionRepo;

    public OrganizationsController(IOrganizationRepository organizationRepo, IGateDefinitionRepository gateDefinitionRepo)
    {
        _organizationRepo = organizationRepo;
        _gateDefinitionRepo = gateDefinitionRepo;
    }

    [HttpGet]
    public async Task<ActionResult<List<Organization>>> GetAll()
    {
        var orgs = await _organizationRepo.GetAllAsync();
        return Ok(orgs);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Organization>> GetById(Guid id)
    {
        var org = await _organizationRepo.GetByIdAsync(id);
        if (org == null) return NotFound();
        return Ok(org);
    }

    [HttpPost]
    public async Task<ActionResult<Organization>> Create([FromBody] Organization organization)
    {
        organization.Id = Guid.NewGuid();
        organization.CreatedAt = DateTime.UtcNow;
        var created = await _organizationRepo.CreateAsync(organization);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<Organization>> Update(Guid id, [FromBody] Organization organization)
    {
        if (id != organization.Id) return BadRequest("ID mismatch");
        
        var existing = await _organizationRepo.GetByIdAsync(id);
        if (existing == null) return NotFound();

        var updated = await _organizationRepo.UpdateAsync(organization);
        return Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id)
    {
        var existing = await _organizationRepo.GetByIdAsync(id);
        if (existing == null) return NotFound();

        await _organizationRepo.DeleteAsync(id);
        return NoContent();
    }

    [HttpGet("{id:guid}/gate-definitions")]
    public async Task<ActionResult<List<QualityGateDefinition>>> GetGateDefinitions(Guid id)
    {
        var definitions = await _gateDefinitionRepo.GetByOrganizationAsync(id);
        return Ok(definitions);
    }

    [HttpPost("{id:guid}/gate-definitions")]
    public async Task<ActionResult<QualityGateDefinition>> UpsertGateDefinition(Guid id, [FromBody] QualityGateDefinition definition)
    {
        definition.OrganizationId = id;
        if (definition.Id == Guid.Empty)
        {
            definition.Id = Guid.NewGuid();
            definition.CreatedAt = DateTime.UtcNow;
        }
        
        var upserted = await _gateDefinitionRepo.UpsertAsync(definition);
        return Ok(upserted);
    }

    [HttpPut("{id:guid}/gate-definitions/{gateCode}")]
    public async Task<ActionResult<QualityGateDefinition>> UpdateGateDefinitionByCode(Guid id, string gateCode, [FromBody] QualityGateDefinition definition)
    {
        var definitions = await _gateDefinitionRepo.GetByOrganizationAsync(id);
        var existing = definitions.FirstOrDefault(d => d.GateCode == gateCode);
        
        if (existing == null) return NotFound($"Gate definition with code {gateCode} not found for this organization.");

        definition.Id = existing.Id;
        definition.OrganizationId = id;
        definition.GateCode = gateCode;
        
        var updated = await _gateDefinitionRepo.UpsertAsync(definition);
        return Ok(updated);
    }

    [HttpPatch("{id:guid}/gate-definitions/{gateCode}/toggle")]
    public async Task<ActionResult> ToggleGateDefinition(Guid id, string gateCode, [FromQuery] bool isEnabled)
    {
        var definitions = await _gateDefinitionRepo.GetByOrganizationAsync(id);
        var existing = definitions.FirstOrDefault(d => d.GateCode == gateCode);
        
        if (existing == null) return NotFound($"Gate definition with code {gateCode} not found for this organization.");

        await _gateDefinitionRepo.ToggleAsync(existing.Id, isEnabled);
        return NoContent();
    }
}
