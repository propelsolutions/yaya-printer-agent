$ErrorActionPreference = "Stop"

$code = @'
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.drv", EntryPoint = "ClosePrinter")]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOA di);

    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter")]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter")]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter")]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "WritePrinter")]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendBytesToPrinter(string printerName, byte[] bytes) {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            return false;
        }

        try {
            var di = new DOCINFOA {
                pDocName = "Yaya Print Job",
                pDataType = "RAW"
            };

            if (!StartDocPrinter(hPrinter, 1, di)) {
                return false;
            }

            try {
                if (!StartPagePrinter(hPrinter)) {
                    return false;
                }

                try {
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    try {
                        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                        int written;
                        return WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out written);
                    } finally {
                        Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    }
                } finally {
                    EndPagePrinter(hPrinter);
                }
            } finally {
                EndDocPrinter(hPrinter);
            }
        } finally {
            ClosePrinter(hPrinter);
        }
    }
}
'@

Add-Type -TypeDefinition $code

[Console]::Out.WriteLine("READY")
[Console]::Out.Flush()

while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line) {
        break
    }

    $jobId = -1
    try {
        $job = $line | ConvertFrom-Json
        $jobId = [int]$job.id
        $bytes = [Convert]::FromBase64String($job.dataBase64)
        $ok = [RawPrinterHelper]::SendBytesToPrinter([string]$job.printerName, $bytes)

        if (-not $ok) {
            throw "Failed to send RAW data to printer '$($job.printerName)'"
        }

        $response = @{ id = $jobId; ok = $true } | ConvertTo-Json -Compress
        [Console]::Out.WriteLine($response)
        [Console]::Out.Flush()
    } catch {
        $message = $_.Exception.Message
        $response = @{ id = $jobId; ok = $false; error = $message } | ConvertTo-Json -Compress
        [Console]::Out.WriteLine($response)
        [Console]::Out.Flush()
    }
}
