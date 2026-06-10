# Yaya Print Agent

Ready-to-run Windows print kit for Yaya Store warehouse label printing.

**Download:** https://github.com/propelsolutions/yaya-printer-agent

Node.js and all dependencies are **already included** — no install steps on the warehouse PC.

## Download on a new PC

1. Open **https://github.com/propelsolutions/yaya-printer-agent**
2. Click **Code → Download ZIP**
3. Extract the ZIP (e.g. to `Downloads\yaya-printer-agent-main`)
4. Plug in the **Xprinter XP-365B** label printer (USB)
5. Double-click **`START PRINT AGENT.bat`** — keep the black window open
6. Open your store admin → **Settings → Printer** → set this PC's location → **Test label**

> **Tip:** For daily use, run **`INSTALL TO THIS PC.bat`** once first. It copies everything to `C:\YayaPrint` and adds a **Yaya Print Agent** shortcut on the desktop.

## What's included

| Item | Purpose |
|------|---------|
| `node/` | Portable Node.js 22 (no separate install) |
| `print-agent/` | Print service, config, and dependencies |
| `START PRINT AGENT.bat` | Daily launcher — run from the extracted folder |
| `INSTALL TO THIS PC.bat` | One-time copy to `C:\YayaPrint` + desktop shortcut |
| `WAREHOUSE-STAFF.txt` | Short instructions for warehouse staff |
| `IT-SETUP-GUIDE.md` | Full IT setup and troubleshooting |

## Daily use (warehouse staff)

1. Double-click **Yaya Print Agent** on the desktop (or `START PRINT AGENT.bat`)
2. Leave the window open while printing
3. Print labels from the admin website as usual

See `WAREHOUSE-STAFF.txt` in this folder.

## Printer name

If labels fail with "printer not found", edit `print-agent\print-agent.config.json` and set `usbPrinterName` to the exact name shown in **Windows Settings → Printers**.

## Updating the kit (IT)

When print-agent code changes, download the latest ZIP from GitHub and replace the folder on the warehouse PC (or run `INSTALL TO THIS PC.bat` again).

To rebuild from source with a custom production URL:

```powershell
cd C:\path\to\yaya-printer-agent
.\prepare-usb.ps1 -OutputPath C:\Temp -ProductionUrl "https://your-store.vercel.app"
```

## Related

- Store admin app: [propelsolutions/yayastore](https://github.com/propelsolutions/yayastore)
