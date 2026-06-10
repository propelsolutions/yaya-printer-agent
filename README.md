# Yaya Print Agent

Windows print agent and USB setup kit for Yaya Store warehouse label printing.

## What's in this repo

| Path | Purpose |
|------|---------|
| `print-agent/` | Local HTTP print service (TSPL/ESC-POS labels) |
| `prepare-usb.ps1` | IT script to build a `YayaPrintSetup` folder for USB sticks |
| `start-print-agent.bat` | Daily launcher (copied to USB as `START PRINT AGENT.bat`) |
| `install-to-pc.bat` | One-time install to `C:\YayaPrint` |
| `IT-SETUP-GUIDE.md` | Full IT and warehouse setup instructions |

## Quick start (IT)

1. Install [Node.js 22 LTS](https://nodejs.org/) on your IT PC.
2. Clone this repo.
3. Build a USB kit:

```powershell
cd C:\path\to\yaya-printer-agent
.\prepare-usb.ps1 -OutputPath E:\ -ProductionUrl "https://your-store.vercel.app"
```

This creates `E:\YayaPrintSetup\` with portable Node.js, dependencies, and launcher scripts.

4. Follow **IT-SETUP-GUIDE.md** for warehouse PC setup and admin binding.

## Related

- Store admin app: [propelsolutions/yayastore](https://github.com/propelsolutions/yayastore)
- Print settings: Admin → Settings → Printer
