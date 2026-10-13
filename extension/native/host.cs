using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Drawing;

// Native Messaging: no network, no QQ automation, only PNG files and clipboard.
class XIFClipboardHost {
    static readonly string Root = Path.GetFullPath(Path.Combine(Path.GetTempPath(), "XImageFlowClipboard"));
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 60 * 1024 * 1024, RecursionLimit = 20 };
    static string folder;
    static int expected;
    static long pixels;
    static readonly SortedDictionary<int, string> files = new SortedDictionary<int, string>();
    static bool committed;
    static byte[] ReadExact(Stream input, int count) {
        byte[] data = new byte[count]; int offset = 0;
        while (offset < count) { int n = input.Read(data, offset, count - offset); if (n == 0) { if (offset == 0) return null; throw new IOException("Incomplete message"); } offset += n; }
        return data;
    }
    static void Reply(Stream output, object value) {
        byte[] data = Encoding.UTF8.GetBytes(Json.Serialize(value));
        output.Write(BitConverter.GetBytes(data.Length), 0, 4); output.Write(data, 0, data.Length); output.Flush();
    }
    static string Text(Dictionary<string, object> message, string key) { object value; return message.TryGetValue(key, out value) && value is string ? (string)value : ""; }
    static int Number(Dictionary<string, object> message, string key) { object value; return message.TryGetValue(key, out value) && value is int ? (int)value : -1; }
    static bool Owned(string path) {
        Guid id; return path != null && Path.GetFullPath(path).StartsWith(Root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) && Guid.TryParse(Path.GetFileName(path), out id);
    }
    static void Reset() {
        if (!committed && Owned(folder) && Directory.Exists(folder)) { try { Directory.Delete(folder, true); } catch {} }
        folder = null; files.Clear(); expected = 0; pixels = 0; committed = false;
    }
    static void CleanOld() {
        Directory.CreateDirectory(Root);
        var active = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        try { foreach (string file in Clipboard.GetFileDropList()) active.Add(Path.GetDirectoryName(file)); } catch { return; }
        foreach (string dir in Directory.GetDirectories(Root)) {
            if (Owned(dir) && !active.Contains(dir) && Directory.GetCreationTimeUtc(dir) < DateTime.UtcNow.AddDays(-7)) { try { Directory.Delete(dir, true); } catch {} }
        }
    }
    static int BigInt(byte[] data, int offset) { return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]; }
    static object Handle(Dictionary<string, object> message) {
        string request = Text(message, "requestId"), operation = Text(message, "op");
        if (operation == "ping") return new { ok = true, requestId = request, version = "1.0.0" };
        if (operation == "begin") {
            Reset(); expected = Number(message, "count"); if (expected < 1 || expected > 4) throw new Exception("图片数量应为 1–4 张");
            CleanOld(); folder = Path.Combine(Root, Guid.NewGuid().ToString("N")); Directory.CreateDirectory(folder);
            return new { ok = true, requestId = request };
        }
        if (operation == "image") {
            int index = Number(message, "index");
            if (!Owned(folder) || index < 0 || index >= expected || files.ContainsKey(index)) throw new Exception("图片顺序无效");
            string data = Text(message, "data"), prefix = "data:image/png;base64,";
            if (!data.StartsWith(prefix, StringComparison.Ordinal) || data.Length > 57 * 1024 * 1024) throw new Exception("PNG 数据无效或过大");
            byte[] bytes = Convert.FromBase64String(data.Substring(prefix.Length));
            byte[] signature = {137, 80, 78, 71, 13, 10, 26, 10};
            if (bytes.Length < 33 || bytes.Length > 40 * 1024 * 1024) throw new Exception("PNG 大小无效");
            for (int i = 0; i < signature.Length; i++) if (bytes[i] != signature[i]) throw new Exception("只接受 PNG 图片");
            if (Encoding.ASCII.GetString(bytes, 12, 4) != "IHDR") throw new Exception("PNG 文件头无效");
            int width = BigInt(bytes, 16), height = BigInt(bytes, 20);
            if (width < 1 || height < 1 || width > 32767 || height > 32767 || pixels + (long)width * height > 100000000) throw new Exception("整组图片尺寸过大");
            string file = Path.Combine(folder, (index + 1).ToString("D2") + ".png");
            File.WriteAllBytes(file, bytes); files.Add(index, file); pixels += (long)width * height;
            return new { ok = true, requestId = request };
        }
        if (operation == "abort") { Reset(); return new { ok = true, requestId = request }; }
        if (operation == "commit") {
            if (files.Count != expected || expected == 0 || committed) throw new Exception("整组图片尚未准备完成");
            var paths = new StringCollection(); foreach (string file in files.Values) paths.Add(file);
            var clipboard = new DataObject(); clipboard.SetFileDropList(paths);
            // Prefer ordinary image paste for a stitched PNG while retaining original PNG.
            if (expected == 1) {
                using (var image = Image.FromFile(files[0]))
                using (var bitmap = new Bitmap(image)) {
                    clipboard.SetImage(bitmap);
                    clipboard.SetData("PNG", false, new MemoryStream(File.ReadAllBytes(files[0])));
                    Clipboard.SetDataObject(clipboard, true, 3, 100);
                }
            } else Clipboard.SetDataObject(clipboard, true, 3, 100);
            committed = true;
            return new { ok = true, requestId = request, count = expected };
        }
        throw new Exception("未知助手操作");
    }
    [STAThread]
    static void Main() {
        var input = Console.OpenStandardInput(); var output = Console.OpenStandardOutput();
        try {
            while (true) {
                byte[] prefix = ReadExact(input, 4); if (prefix == null) break;
                int length = BitConverter.ToInt32(prefix, 0); if (length < 2 || length > 60 * 1024 * 1024) break;
                string request = "";
                try {
                    byte[] payload = ReadExact(input, length); if (payload == null) break;
                    var message = Json.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(payload));
                    request = Text(message, "requestId"); Reply(output, Handle(message));
                } catch (Exception error) { Reply(output, new { ok = false, requestId = request, error = error.Message }); }
            }
        } catch {} finally { Reset(); }
    }
}
