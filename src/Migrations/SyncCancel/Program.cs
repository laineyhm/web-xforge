﻿using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Reflection;
using System.Threading.Tasks;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using SIL.XForge.Scripture.Services;

namespace SyncCancel
{
    /// <summary>
    /// Cancel Sync on all SF projects between SF DB and Paratext Data Access Web API.
    /// Fails to run if SF server is running, with error
    /// > System.Net.Http.HttpRequestException: An error occurred while sending the request.
    /// >  ---> System.IO.IOException: The response ended prematurely.
    /// This app works by starting up a subset of the regular SF services, then using SF as a library to perform tasks.
    /// </summary>
    public class Program
    {
        public static readonly char Bullet1 = '>';
        public static readonly char Bullet2 = '*';
        public static readonly char Bullet3 = '-';
        public static IProgramLogger Logger;

        public static async Task Main(string[] args)
        {
            string sfAppDir = Environment.GetEnvironmentVariable("SF_APP_DIR") ?? "../../SIL.XForge.Scripture";
            Directory.SetCurrentDirectory(sfAppDir);
            IWebHostBuilder builder = CreateWebHostBuilder(args);
            IWebHost webHost = builder.Build();
            Logger = webHost.Services.GetService<IProgramLogger>();
            Logger.Log($"Starting.");

            try
            {
                await webHost.StartAsync();
            }
            catch (HttpRequestException)
            {
                Logger.Log("There was an error starting the program before getting to the inspection or migration. "
                    + "Maybe the SF server is running on this machine and needs shut down? Rethrowing.");
                throw;
            }
            ISyncCancelService tool = webHost.Services.GetService<ISyncCancelService>();
            string projectIds = Environment.GetEnvironmentVariable("CANCEL_PROJECT_IDS");
            var cancelProjectIds = string.IsNullOrEmpty(projectIds) ? null : new HashSet<string>(projectIds.Split(' '));
            await tool.SynchronizeCancelProjectsAsync(cancelProjectIds);
            await webHost.StopAsync();
            Logger.Log("Done.");
        }

        /// <summary>
        /// This was copied and modified from `SIL.XForge.Scripture/Program.cs`.
        /// </summary>
        public static IWebHostBuilder CreateWebHostBuilder(string[] args)
        {
            IWebHostBuilder builder = WebHost.CreateDefaultBuilder(args);

            // Secrets to connect to PT web API are associated with the SIL.XForge.Scripture assembly.
            Assembly sfAssembly = Assembly.GetAssembly(typeof(ParatextService));

            IConfigurationRoot configuration = new ConfigurationBuilder()
                .AddUserSecrets(sfAssembly)
                .SetBasePath(Directory.GetCurrentDirectory())
                .Build();

            return builder
                .ConfigureAppConfiguration((context, config) =>
                    {
                        IWebHostEnvironment env = context.HostingEnvironment;
                        if (env.IsDevelopment() || env.IsEnvironment("Testing"))
                            config.AddJsonFile("appsettings.user.json", true);
                        else
                            config.AddJsonFile("secrets.json", true, true);
                        if (env.IsEnvironment("Testing"))
                        {
                            var appAssembly = Assembly.Load(new AssemblyName(env.ApplicationName));
                            if (appAssembly != null)
                                config.AddUserSecrets(appAssembly, true);
                        }
                        config.AddEnvironmentVariables();
                    })
                .UseConfiguration(configuration)
                .UseStartup<Startup>();
        }
    }
}
