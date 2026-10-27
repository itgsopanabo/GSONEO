<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Issues a one-time password from the server console, for when no admin can
 * sign in to do it from the User List: the first Superadmin on a new install,
 * or an admin account locked when the shared default password was retired.
 *
 *   php artisan user:one-time-password 12345
 *
 * Prints the password once. The user must choose their own at first sign-in.
 */
class IssueOneTimePassword extends Command
{
    protected $signature = 'user:one-time-password {emp_id : Employee ID of the account}';

    protected $description = 'Issue a one-time password for an account and print it once';

    public function handle(): int
    {
        $user = User::where('emp_id', (int) $this->argument('emp_id'))->first();

        if (! $user) {
            $this->error('No account has that employee ID.');

            return self::FAILURE;
        }

        $password = $user->issueTemporaryPassword();
        DB::table(config('session.table', 'sessions'))->where('emp_id', $user->emp_id)->delete();

        AuditLog::create([
            'user_id' => null,
            'action' => 'password_reset',
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'description' => "Issued a one-time password from the server console for {$user->emp_fname} {$user->emp_lname} (employee {$user->emp_id}) and signed them out",
            'old_values' => null,
            'new_values' => null, // never record the password
        ]);

        $this->info("One-time password for {$user->emp_lname}, {$user->emp_fname} (employee {$user->emp_id}):");
        $this->line($password);
        $this->line('It works until '.$user->temporary_password_expires_at->format('M j, Y g:i A').'. They must choose their own at first sign-in.');

        return self::SUCCESS;
    }
}
