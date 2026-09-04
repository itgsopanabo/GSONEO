<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Session\DatabaseSessionHandler;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);


        Gate::define('record_classes.manage', fn($user) => $user->role?->id === 1);

        Gate::define('has-role', function (User $user, string $roleName) {
            return $user->hasRole($roleName);
        });


        Gate::define('verify-pr', function ($user) {
            return in_array($user->role->role_name, ['PR Verifier', 'Department Head', 'Section Head', 'Superadmin']);
        });

        Gate::define('canvass', function ($user) {
            return in_array($user->role->role_name, ['Canvas Officer', 'Department Head', 'Section Head', 'Superadmin']);
        });

        Gate::define('proceedPO', function ($user) {
            return in_array($user->role->role_name, ['PO Officer', 'Department Head', 'Section Head', 'Superadmin']);
        });

        Gate::define('proceedIAR', function ($user) {
            return in_array($user->role->role_name, ['Encoder(IAR)', 'Department Head', 'Section Head', 'Superadmin']);
        });

        Gate::define('proceedSSMI', function ($user) {
            return in_array($user->role->role_name, ['Encoder(SSMI)', 'Department Head', 'Section Head', 'Superadmin']);
        });

        Gate::define('proceedRIS', function ($user) {
            return in_array($user->role->role_name, ['Encoder(RIS)', 'Department Head', 'Section Head', 'Superadmin']);
        });

        Gate::define('records.view', fn($user) => in_array($user->role?->section, ['Records (Archives)', 'Sys Admin'], true));

        Gate::define('users.manage', fn (User $user) => $user->id === 1);

        // property custodian only — land titles and other restricted classes
        Gate::define('records.view_restricted', fn($user) => in_array($user->role?->id, [1, /* add the custodian role id */], true));

        Session::extend('database', function ($app) {
            $table = $app['config']['session.table'];
            $connection = $app['db']->connection($app['config']['session.connection']);

            return new class($connection, $table, $app['config']['session.lifetime'], $app) extends DatabaseSessionHandler {
                /**
                 * Add the user information to the session payload.
                 *
                 * @param array $payload
                 * @return $this
                 */
                protected function addUserInformation(&$payload)
                {
                    if ($this->container->bound('auth') &&
                        $this->container['auth']->guard()->check()) {

                        // Safely inject your custom emp_id column instead of user_id
                        $payload['emp_id'] = $this->container['auth']->guard()->user()->getAuthIdentifier();
                    }

                    return $this;
                }
            };
        });

    }
}
