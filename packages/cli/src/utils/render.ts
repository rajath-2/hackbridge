import chalk from 'chalk';

export type Severity = 'OK' | 'WARN' | 'FAIL';

export interface CheckResult {
  label: string;
  severity: Severity;
  message: string;
}

export function printCheck(label: string, severity: Severity, message: string): void {
  const icon = severity === 'OK' ? '✓' : severity === 'WARN' ? '⚠' : '✗';
  const color = severity === 'OK' ? chalk.green : severity === 'WARN' ? chalk.yellow : chalk.red;
  console.log(`${color(`${icon} ${label.padEnd(20)}`)} ${message}`);
}

export function printSeparator(): void {
  console.log(chalk.gray('-'.repeat(40)));
}

export function printSection(title: string): void {
  console.log(`\n${chalk.bold.blue(title.toUpperCase())}`);
  printSeparator();
}

export function printSummary(results: CheckResult[]): void {
  const fails = results.filter(r => r.severity === 'FAIL').length;
  const warns = results.filter(r => r.severity === 'WARN').length;
  const oks = results.filter(r => r.severity === 'OK').length;

  console.log('\n' + chalk.bold('Summary:'));
  if (fails > 0) console.log(chalk.red(`  ${fails} FAIL`));
  if (warns > 0) console.log(chalk.yellow(`  ${warns} WARN`));
  console.log(chalk.green(`  ${oks} OK`));

  if (fails === 0 && warns === 0) {
    console.log(chalk.bold.green('\n✓ All checks passed!'));
  } else if (fails > 0) {
    console.log(chalk.bold.red('\n✗ Some critical issues found. Run `hackbridge doctor --fix` to attempt repairs.'));
  } else {
    console.log(chalk.bold.yellow('\n⚠ Warnings found. Review above items.'));
  }
}
