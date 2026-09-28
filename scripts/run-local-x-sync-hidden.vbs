Option Explicit

Dim args, shell, command, exitCode, index
Set args = WScript.Arguments

If args.Count < 2 Then
  WScript.Quit 2
End If

Set shell = CreateObject("WScript.Shell")
command = Chr(34) & args(0) & Chr(34)
For index = 1 To args.Count - 1
  command = command & " " & Chr(34) & args(index) & Chr(34)
Next
exitCode = shell.Run(command, 0, True)
WScript.Quit exitCode
