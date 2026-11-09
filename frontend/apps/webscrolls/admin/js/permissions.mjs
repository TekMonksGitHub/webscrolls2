/**
 * Permissions page for admin, JS module.
 * (C) 2025 TekMonks. All rights reserved.
 * License: See enclosed license.txt file.
 * 
 * Site: 
 *  Read means theme list will show up, for themes where user can read post types, 
 *  Write means the user can create new themes
 *  Delete means the user can delete existing themes
 * 
 * Theme 
 *  Read means the user can read the post types
 *  Write means the user can create new post types
 *  Delete means the user can delete post types
 * 
 * Post Type
 *  Read means the user can read the posts
 *  Write means the user can create new posts
 *  Delete means the user can delete posts
 */

import {loginmanager} from "../../js/loginmanager.mjs";

function createdata() {
    const testdata = {
        "site": {theme_count: 1, user_count: 4},
        "themes": [{"name":"default", "posttypes": [{"name":"home", "posts_count": 1, "theme":"default"}], "posttypes_count": 1}],
        "users": [
            {"icon": "AR", "name": "Anita Rao", "email": "anita.rao@example.com", "rule_count": 9, "first": true},
            {"icon": "DT", "name": "Daniel Tan", "email": "daniel.tan@example.com", "rule_count": 3},
            {"icon": "MS", "name": "Mei Suzuki", "email": "mei.suzuki@example.com", "rule_count": 0 },
            {"icon": "PR", "name": "Priya Nair", "email": "priya.nair@example.com", "rule_count": 3 }
        ],
        "selected_user": {"name": "Anita Rao", "email": "anita.rao@example.com"},
        "permissions": {
            "anita.rao@example.com": [
                "site|read", "site|write", "site|delete", 
                "site/default|read", "site/default|write", "site/default|delete",
                "site/default/home|read", "site/default/home|write", "site/default/home|delete",
            ],
            "daniel.tan@example.com": ["site|read", "site/default|read", "site/default/home|read"],
            "mei.suzuki@example.com": [],
            "priya.nair@example.com": ["site/default/home|read", "site/default/home|write", "site/default/home|delete"]
        }
    }

    return testdata;
}

function userSelected(element, email) {}

function addUser(name, email) {}

export const permissions = {createdata, logout: loginmanager.logout, userSelected, addUser}