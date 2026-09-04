namespace CourseDeveloper.Core.Interfaces;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CourseDeveloper.Core.Models;

public interface IQualityReceiptRepository
{
    Task<QualityReceipt> CreateAsync(QualityReceipt receipt);
    Task<List<QualityReceipt>> GetBySessionAsync(Guid sessionId);
}
