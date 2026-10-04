// Reads the SMTP app password from the macOS login Keychain. The password is
// never written to disk by this project; add it with scripts/setup-keychain.sh.
import { execFileSync } from 'node:child_process';

export function getKeychainPassword(service, account) {
  try {
    return execFileSync('/usr/bin/security', ['find-generic-password', '-s', service, '-a', account, '-w'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    throw new Error(
      `No Keychain item for service "${service}" / account "${account}". Run: ./scripts/setup-keychain.sh`
    );
  }
}
