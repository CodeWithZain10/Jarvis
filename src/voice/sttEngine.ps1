# JARVIS Speech-to-Text Engine with Weighted Command Grammar
param (
    [int]$TimeoutSeconds = 8
)

Add-Type -AssemblyName System.Speech

try {
    # Short audio settle pause
    Start-Sleep -Milliseconds 250

    $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine

    # 1. Custom Command Choices for High Accuracy (>95% phonetic matching)
    $commandChoices = New-Object System.Speech.Recognition.Choices
    $commandChoices.Add(@(
        "open chrome", "chrome kholo", "chrome open karo", "launch chrome", "browser kholo",
        "open vs code", "vs code kholo", "vs code open karo", "code kholo",
        "open notepad", "notepad kholo", "notepad open karo",
        "open calculator", "calculator kholo", "calc open karo",
        "open explorer", "file explorer kholo", "explorer open karo", "files kholo",
        "battery kitni hai", "battery status", "check battery", "battery percentage",
        "volume barhao", "volume up", "volume kam karo", "volume down", "mute karo", "unmute karo",
        "screenshot lo", "take screenshot", "screen capture karo",
        "whats the weather today", "what is the weather today", "mausam kaisa hai",
        "go to sleep", "go to sleep jarvis", "sleep jarvis", "so jao",
        "exit jarvis", "stop jarvis", "exit", "clear history",
        "yes", "haan", "no", "nahi"
    ))

    $gb = New-Object System.Speech.Recognition.GrammarBuilder
    $gb.Append($commandChoices)
    $customGrammar = New-Object System.Speech.Recognition.Grammar($gb)
    $customGrammar.Name = "JarvisCommands"
    $customGrammar.Weight = 1.0

    # 2. General Dictation Grammar for open-ended AI questions
    $dictationGrammar = New-Object System.Speech.Recognition.DictationGrammar
    $dictationGrammar.Name = "JarvisDictation"
    $dictationGrammar.Weight = 0.2

    $engine.LoadGrammar($customGrammar)
    $engine.LoadGrammar($dictationGrammar)

    $engine.SetInputToDefaultAudioDevice()

    # Audio sensitivity timeouts
    $engine.InitialSilenceTimeout = [TimeSpan]::FromSeconds(5)
    $engine.BabbleTimeout = [TimeSpan]::FromSeconds($TimeoutSeconds)
    $engine.EndSilenceTimeout = [TimeSpan]::FromSeconds(0.8)
    $engine.EndSilenceTimeoutAmbiguous = [TimeSpan]::FromSeconds(0.8)

    $timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)
    $result = $engine.Recognize($timeout)

    if ($result -ne $null -and $result.Text -ne "") {
        [PSCustomObject]@{
            success = $true;
            text = $result.Text;
            confidence = $result.Confidence
        } | ConvertTo-Json -Compress
    } else {
        [PSCustomObject]@{
            success = $true;
            text = "";
            confidence = 0
        } | ConvertTo-Json -Compress
    }
} catch {
    [PSCustomObject]@{
        success = $false;
        error = $_.Exception.Message;
        text = ""
    } | ConvertTo-Json -Compress
}
