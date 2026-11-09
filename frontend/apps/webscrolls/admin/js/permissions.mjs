/**
 * Permissions page for admin, JS module.
 * (C) 2025 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

import {loginmanager} from "../../js/loginmanager.mjs";

function createdata() {
    return {};
}

function userSelected(element, email) {}

function addUser(name, email) {}

export const permissions = {createdata, logout: loginmanager.logout, userSelected, addUser}