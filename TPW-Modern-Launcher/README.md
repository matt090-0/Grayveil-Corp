# Theme Park World Modern Launcher

A small Windows launcher/fix utility for **Theme Park World (1999)** on modern Windows PCs.

**Status:** Community beta — v0.5.0

This tool was built after testing several modern compatibility paths. The current working route keeps Theme Park World's original Direct3D 3 renderer and uses the TPW-tested DDrawCompat setup rather than stacking multiple wrappers.

## What it does

- Finds your existing `TP.exe` installation.
- Creates a backup before changing anything.
- Removes conflicting experimental dgVoodoo / DxWnd / WinMM wrapper files left by earlier attempts.
- Downloads the TPW-tested DDrawCompat `DDraw.dll` from the public [TPW-TPI-Fixes](https://github.com/HyperJeanJean/TPW-TPI-Fixes) project.
- Installs the matching DDrawCompat configuration.
- Keeps the game at a stable **1024x768 internal resolution** while DDrawCompat presents it at desktop resolution.
- Enables the game's 32-bit renderer and 32-bit textures.
- Applies the documented TP.exe texture-memory calculation fix when the executable signature is recognised.
- Protects the game's font folder.
- Includes **Restore Backup** and **Copy Report** options.

## Requirements

- Windows 10 or Windows 11.
- An existing legal installation of Theme Park World / Sim Theme Park.
- The game should be updated to the **2.0 patch** before using this launcher.
- Internet access the first time the clean fix is applied, so DDrawCompat can be downloaded from the public TPW-TPI-Fixes repository.

**No Theme Park World game files, copyrighted assets, cracks, or CD images are included.**

## Install / use

1. Download `TPW_Modern_Launcher_v0.5.0.zip` from this folder.
2. Extract the ZIP somewhere convenient.
3. Run `Launch TPW Modern Launcher.cmd`.
4. If Theme Park World is installed under `Program Files (x86)`, use **Run as Administrator** in the launcher.
5. Make sure the launcher has found the folder containing `TP.exe`.
6. Click **APPLY CLEAN FIX**.
7. When it finishes, perform a real **Windows Restart** once.
8. Re-open the launcher and click **PLAY CLEAN FIX**.

## Why the restart matters

Theme Park World has an old timing issue that can cause extremely low or apparently frozen animation after Windows has been running for a long time. A real Windows **Restart** resets that state. The launcher warns when Windows uptime is high instead of injecting another timing DLL into the game.

## Troubleshooting

If something goes wrong, open the launcher and use **Restore Backup**. The launcher backs up the relevant files before applying the clean fix.

If the game starts but performance is poor, restart Windows first before changing renderer settings. Avoid stacking dgVoodoo, DxWnd proxy mode, DDrawCompat, and WinMM timing shims at the same time.

For useful diagnostics, click **Copy Report** and include the copied text when reporting a problem.

## Credits / upstream projects

This launcher is an unofficial community utility and is not affiliated with Electronic Arts or Bullfrog Productions.

Compatibility work used by the launcher is based on the excellent public work in:

- [TPW-TPI-Fixes](https://github.com/HyperJeanJean/TPW-TPI-Fixes)
- [DDrawCompat](https://github.com/narzoul/DDrawCompat)

The launcher itself does not bundle DDrawCompat; it downloads the TPW-tested build at runtime from TPW-TPI-Fixes.

## Release checksum

See `SHA256.txt` in this folder to verify the ZIP after downloading.
