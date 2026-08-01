' Start the print agent hidden (no console window). Used by Task Scheduler.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

kitRoot = fso.GetParentFolderName(WScript.ScriptFullName)
agentDir = kitRoot & "\print-agent"
nodeExe = kitRoot & "\node\node.exe"

If Not fso.FolderExists(agentDir) Then
  WScript.Echo "print-agent folder not found: " & agentDir
  WScript.Quit 1
End If

If Not fso.FileExists(nodeExe) Then
  nodeExe = "C:\Program Files\nodejs\node.exe"
End If

If Not fso.FileExists(nodeExe) Then
  WScript.Echo "Node.js not found. Run INSTALL TO THIS PC.bat or install Node.js 22 LTS."
  WScript.Quit 1
End If

shell.CurrentDirectory = agentDir
shell.Run """" & nodeExe & """ node_modules\tsx\dist\cli.mjs src\index.ts", 0, False
