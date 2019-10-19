using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Microsoft.WindowsAzure.Storage;
using Microsoft.WindowsAzure.Storage.Blob;

namespace TranscriptsReader
{
    public static class DownloadBlob
    {
        [FunctionName("DownloadBlob")]
        public static async Task<IActionResult> Run(
           [HttpTrigger(AuthorizationLevel.Function, "post", Route = null)] HttpRequest req,
           ILogger log)
        {
            log.LogInformation("C# HTTP trigger function processed a request.");
            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            dynamic data = JsonConvert.DeserializeObject(requestBody);
            var uri = data?.blobUri;
            var res = "";
            CloudStorageAccount storageAccount;
            if (CloudStorageAccount.TryParse(Environment.GetEnvironmentVariable("AzureStorageConnectionString"), out storageAccount))
            {
                var cloudBlobClient = storageAccount.CreateCloudBlobClient();
                ICloudBlob blob = await cloudBlobClient.GetBlobReferenceFromServerAsync(new Uri(uri.ToString()));
                Stream s = new MemoryStream();
                await blob.DownloadToStreamAsync(s);
                s.Seek(0, SeekOrigin.Begin);
                StreamReader reader = new StreamReader(s);
                res = reader.ReadToEnd();
            }


            return res != ""
                ? (ActionResult)new OkObjectResult(res)
                : new BadRequestObjectResult("There was problem reading the file");
        }
    }
}
