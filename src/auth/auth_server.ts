import express from 'express';
import { AuthManager } from './auth_manager';

export function create_app(server: {port: number, redirect_url?: string}, auth_manager: AuthManager, auth_process_id: number): any {
    const app = express();
    app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.get('/callback', (req, res) => {
        if(req.query.error) {
            if(server.redirect_url)
                res.redirect(server.redirect_url + "?status=error&error=" + req.query.error + "&error_description=" + req.query.error_description);
            else
                res.status(401).send("Unable to log: " + req.query.error_description);
        }
        else
        {
            if(req.query.code)
            {
                auth_manager.response_auth_process(auth_process_id, req.query.code as string);
                if(server.redirect_url)
                    res.redirect(server.redirect_url + "?status=success");
                else
                    res.status(200).send("Successfully logged in");
            }
            else
            {
                if(server.redirect_url)
                    res.redirect(server.redirect_url + "?status=error&error=no-code" + "&error_description=No+code+were+provided+by+42");
                else
                    res.status(400).send("Unable to log: No code were provided by 42");
            }
        }
    });
    return app;
}