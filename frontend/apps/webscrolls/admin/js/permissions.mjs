/**
 * Permissions page for admin, JS module.
 * (C) 2025 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 */

import {loginmanager} from "../../js/loginmanager.mjs";

export const permissions = {createdata: _ => {return {}}, logout: loginmanager.logout}