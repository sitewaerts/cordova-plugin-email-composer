// Type definitions for Apache Cordova EmailComposer plugin
// Project: https://github.com/regnete/cordova-plugin-email-composer
// Definitions by: Microsoft Open Technologies Inc. <http://msopentech.com>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
//
// Copyright (c) Microsoft Open Technologies Inc
// Licensed under the MIT license

interface EmailComposerOptions {
    app?: string,
    from?: string,
    subject?: string,
    body?: string | Array<string>,
    to?: string | Array<string>,
    cc?: string | Array<string>,
    bcc?: string | Array<string>,
    attachments?: [],
    isHtml?: boolean,
    chooserHeader?: string
}

declare enum EmailComposerPermission {
    READ_MEDIA_IMAGES= 1,
    READ_MEDIA_VIDEO= 2,
    READ_MEDIA_AUDIO= 3,
    READ_ACCOUNTS= 4
}

/**
 *
 */
interface EmailComposer {

    /**
     * List of all registered mail app aliases.
     */
    aliases: Record<string, string>

    /**
     * Adds a new mail app alias.
     *
     * @param alias The alias name.
     * @param packageName The package name.
     */
    addAlias: (alias: string, packageName: string) => void


    /**
     * List of possible permissions to request.
     */
    permission: {
        READ_MEDIA_IMAGES: EmailComposerPermission.READ_MEDIA_IMAGES,
        READ_MEDIA_VIDEO: EmailComposerPermission.READ_MEDIA_VIDEO,
        READ_MEDIA_AUDIO: EmailComposerPermission.READ_MEDIA_AUDIO,
        READ_ACCOUNTS: EmailComposerPermission.READ_ACCOUNTS
    }

    /**
     * List of all available options with their default value.
     */
    getDefaults: () => EmailComposerOptions


    /**
     * Informs if the app has the given permission
     * .
     * @param permission The permission to check.
     * @param callback The callback function.
     * @param scope The scope of the callback.
     */
    hasPermission: (permission: EmailComposerPermission, callback: (hasPermission: boolean) => void, scope?: any) => void


    /**
     * Request given permission if not already granted.
     *
     * @param permission The permission to grant.
     * @param callback The callback function.
     * @param scope The scope of the callback.
     */
    requestPermission: (permission: EmailComposerPermission, callback: (hasPermission: boolean) => void, scope?: any) => void

    /**
     * Tries to find out if the device has an email account configured.
     *
     * @param callback The callback function.
     * @param scope The scope of the callback.
     */
    hasAccount: (callback: (hasAccount: boolean) => void, scope?: any) => void

    /**
     * Tries to find out if the device has an email client installed.
     *
     * @param app An optional app id or uri scheme. Defaults to mailto.
     * @param callback The callback function.
     * @param scope The scope of the callback.
     */
    hasClient: (app: string, callback: (hasClient: boolean) => void, scope?: any) => void

    /**
     * List of package IDs for all available email clients (Android only).
     *
     * @param callback The callback function.
     * @param scope The scope of the callback.
     */
    getClients: (callback: (clients: Array<string> | null) => void, scope?: any) => void


    /**
     * Displays the email composer pre-filled with data.
     *
     * @param options  The email properties like the body,...
     * @param callback The callback function.
     * @param scope The scope of the callback.
     */
    open: (options: EmailComposerOptions, callback: (error: any) => void, scope?: any) => void

    /**
     * Displays the email composer pre-filled with data.
     *
     * @param options  The email properties like the body,...
     * @param callback The callback function.
     * @param scope The scope of the callback.
     */
    openDraft: (options: EmailComposerOptions, callback: (error: any) => void, scope?: any) => void


}

// plugin available at window.cordova.plugins.email
interface Cordova {
    plugins: {
        email: EmailComposer
    }
}
