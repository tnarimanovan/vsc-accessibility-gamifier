import * as vscode from 'vscode';
import * as fs from 'fs';

export interface TelemetryData {
  sessionStartTime: number;
  initialHealthScore: number;
  finalHealthScore: number;
  totalXpEarned: number;
  unlockedBadges: string[];
  initialViolationsCount: number;
  remainingViolationsCount: number;
  fixedRulesList: string[];
}

export async function exportStudyReport(telemetryData: TelemetryData) {

  const diffMs = Date.now() - telemetryData.sessionStartTime;
  const timeSpentMinutes = Math.round((diffMs / 60000) * 10) / 10;


  const scoreDelta = telemetryData.finalHealthScore - telemetryData.initialHealthScore;
  const formattedScoreDelta = scoreDelta >= 0 ? `+${scoreDelta}` : `${scoreDelta}`;


  const fixedCount = Math.max(
    0,
    telemetryData.initialViolationsCount - telemetryData.remainingViolationsCount
  );


  const reportContent = {
    experimentMetaData: {
      extensionVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      totalTimeSpentMinutes: timeSpentMinutes,
    },
    scores: {
      initialHealthScore: telemetryData.initialHealthScore,
      finalHealthScore: telemetryData.finalHealthScore,
      scoreDelta: formattedScoreDelta,
    },
    gamificationStats: {
      totalXpEarned: telemetryData.totalXpEarned,
      unlockedBadges: telemetryData.unlockedBadges,
      badgesCount: telemetryData.unlockedBadges.length,
    },
    codeMetrics: {
      initialViolationsCount: telemetryData.initialViolationsCount,
      fixedViolationsCount: fixedCount,
      remainingViolationsCount: telemetryData.remainingViolationsCount,
      fixedRulesList: telemetryData.fixedRulesList,
    },
  };

  const jsonString = JSON.stringify(reportContent, null, 2);
  const defaultFileName = `a11y-report-${Date.now()}.json`;


  const fileUri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(defaultFileName),
    filters: { 'JSON Files': ['json'] },
    saveLabel: 'Save Experiment Report',
  });

  if (fileUri) {
    fs.writeFile(fileUri.fsPath, jsonString, (err) => {
      if (err) {
        vscode.window.showErrorMessage(`Failed to save report: ${err.message}`);
      } else {
        vscode.window.showInformationMessage(
          'Report saved successfully! Please attach this file to your Post-Study Survey.',
        );
      }
    });
  }
}