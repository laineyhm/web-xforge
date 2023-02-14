using System.IO;
using System.Threading.Tasks;
using Jering.Javascript.NodeJS;

namespace SIL.XForge.Realtime;

public class RealtimeServer : IRealtimeServer
{
    private readonly INodeJSService _nodeJSService;
    private readonly string _modulePath;
    private bool _started;

    public RealtimeServer(INodeJSService nodeJSService)
    {
        _nodeJSService = nodeJSService;
        _modulePath = Path.Combine("RealtimeServer", "lib", "cjs", "common", "index");
    }

    public void Start(object options)
    {
        if (_started)
            return;
        InvokeExportAsync("start", options).GetAwaiter().GetResult();
        _started = true;
    }

    public void Stop()
    {
        if (!_started)
            return;
        InvokeExportAsync("stop").GetAwaiter().GetResult();
        _started = false;
    }

    public Task<int> ConnectAsync(string? userId = null)
    {
        if (userId != null)
            return InvokeExportAsync<int>("connect", userId);
        return InvokeExportAsync<int>("connect");
    }

    public Task<Snapshot<T>> CreateDocAsync<T>(int handle, string collection, string id, T data, string otTypeName) =>
        InvokeExportAsync<Snapshot<T>>("createDoc", handle, collection, id, data, otTypeName);

    public Task<Snapshot<T>> FetchDocAsync<T>(int handle, string collection, string id) =>
        InvokeExportAsync<Snapshot<T>>("fetchDoc", handle, collection, id);

    public Task<Snapshot<T>> SubmitOpAsync<T>(int handle, string collection, string id, object op) =>
        InvokeExportAsync<Snapshot<T>>("submitOp", handle, collection, id, op);

    public Task DeleteDocAsync(int handle, string collection, string id) =>
        InvokeExportAsync("deleteDoc", handle, collection, id);

    public void Disconnect(int handle) => InvokeExportAsync("disconnect", handle).GetAwaiter().GetResult();

    public Task DisconnectAsync(int handle) => InvokeExportAsync("disconnect", handle);

    public Task<T> ApplyOpAsync<T>(string otTypeName, T data, object op) =>
        InvokeExportAsync<T>("applyOp", otTypeName, data, op);

    private Task<T> InvokeExportAsync<T>(string exportedFunctionName, params object?[] args) =>
        _nodeJSService.InvokeFromFileAsync<T>(_modulePath, exportedFunctionName, args);

    private Task InvokeExportAsync(string exportedFunctionName, params object[] args) =>
        _nodeJSService.InvokeFromFileAsync(_modulePath, exportedFunctionName, args);
}
