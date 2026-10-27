<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * One-time passwords replace the shared default password.
 *
 * New and reset accounts used to share one known password, so anyone who knew
 * it could sign in as a user who had not changed theirs yet, then lock them
 * out by choosing a new one. An admin now issues each account its own random
 * password. It works until the user replaces it at first sign-in, or until
 * `temporary_password_expires_at` passes; NULL means the user chose their own.
 *
 * Accounts still on the old default are locked here: their password becomes a
 * random one nobody knows. Their employee IDs go to the log. An admin issues
 * each a one-time password from the User List, or from the console with
 * `php artisan user:one-time-password {emp_id}` if no admin can sign in.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('temporary_password_expires_at')->nullable()->after('password');
        });

        // The old shared defaults: the configured one, and the fallback that
        // shipped in config/Users.php. Both are already in the git history.
        $oldDefaults = array_unique(array_filter([env('USER_DEFAULT_PASSWORD'), 'gso123']));
        $locked = [];

        foreach (DB::table('users')->select(['id', 'emp_id', 'password'])->lazyById() as $user) {
            if (! collect($oldDefaults)->contains(fn ($old) => Hash::check($old, $user->password))) {
                continue;
            }

            DB::table('users')->where('id', $user->id)->update([
                'password' => Hash::make(Str::random(40)),
                'remember_token' => Str::random(60),
                'temporary_password_expires_at' => now(),
            ]);
            DB::table(config('session.table', 'sessions'))->where('emp_id', $user->emp_id)->delete();

            $locked[] = $user->emp_id;
        }

        if ($locked) {
            Log::warning('Accounts still on the old default password were locked. Issue each a one-time password.', [
                'emp_ids' => $locked,
            ]);
        }
    }

    /** Drops the column only; locked accounts keep their random passwords. */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('temporary_password_expires_at');
        });
    }
};
