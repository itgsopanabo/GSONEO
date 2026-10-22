<?php

namespace App\Providers;

use App\Models\User;
use App\Services\DocumentBranding;
use Illuminate\Session\DatabaseSessionHandler;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\View;
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

        // Every generated PDF prints the letterhead, footer and watermark set
        // on the Document Branding screen, and the names on the Signatories one.
        // Partials inherit them from their document instead of reading them again.
        View::composer('pdf.*', function ($view) {
            if (! array_key_exists('branding', $view->getData())) {
                $view->with('branding', DocumentBranding::forPdf());
                $view->with('signatories', DocumentBranding::signatories());
            }
        });


        // Access comes from the permissions assigned to the user's role on the
        // Roles & permissions screen, so `$user->can('pr.verify')` and
        // `can:` checks read the same source as the `permission:` middleware.
        // Returning null (not false) leaves any other gate or policy in charge.
        Gate::before(fn (User $user, string $ability) => $user->hasPermission($ability) ? true : null);

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
