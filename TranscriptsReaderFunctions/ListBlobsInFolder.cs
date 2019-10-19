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
using System.Collections.Generic;
using Microsoft.WindowsAzure.Storage.Blob;

namespace TranscriptsReader
{
    public static class ListBlobsInFolder
    {
        [FunctionName("ListBlobsInFolder")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Function, "post", Route = null)] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("C# HTTP trigger function processed a request.");

            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            dynamic data = JsonConvert.DeserializeObject(requestBody);
            string container = data?.container;
            string path = data?.path;

            var random = new Random();
            CloudStorageAccount storageAccount;

            List<BlobDetail> blobResults = new List<BlobDetail>();
            if (CloudStorageAccount.TryParse(Environment.GetEnvironmentVariable("AzureStorageConnectionString"), out storageAccount))
            {
                // If the connection string is valid, proceed with operations against Blob
                // storage here.
                // ADD OTHER OPERATIONS HERE

                var cloudBlobClient = storageAccount.CreateCloudBlobClient();
                CloudBlobContainer blobContainer = cloudBlobClient.GetContainerReference(container);
                var dir = blobContainer.GetDirectoryReference(path);
                var blobs = await dir.ListBlobsSegmentedAsync(null);

                foreach (var r in blobs.Results)
                {
                    var blob = await cloudBlobClient.GetBlobReferenceFromServerAsync(r.Uri);
                    string timestamp;
                    blob.Metadata.TryGetValue("timestamp", out timestamp);

                    var bd = new BlobDetail() { Uri = r.Uri.ToString(), Timestamp = timestamp };
                    blobResults.Add(bd);
                }
            }

            return (ActionResult)new OkObjectResult(JsonConvert.SerializeObject(blobResults));
            //: new BadRequestObjectResult("Please pass a name on the query string or in the request body");
        }
    }

    class BlobDetail
    {
        [JsonProperty("uri")]
        public string Uri { get; set; }

        [JsonProperty("timestmap")]
        public string Timestamp { get; set; }
    }
}
