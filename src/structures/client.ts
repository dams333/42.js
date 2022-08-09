import querystring from "node:querystring";
import axios, { AxiosError, AxiosResponse } from "axios";
import Bottleneck from "bottleneck";
import { UserManager } from "../managers/UserManager";
import { CampusManager } from "../managers/CampusManager";
import { Loader } from "../utils/loader";

const limiter = new Bottleneck({
	maxConcurrent: 2,
	minTime: 500,
});

export class Client {
	private _id: string;
	private _secret: string;
	private _token: null | string = null;
	static uri: string = "https://api.intra.42.fr/v2/";

	users = new UserManager(this);
	campus = new CampusManager(this);

	constructor(id: string, secret: string) {
		this._id = id;
		this._secret = secret;
	}

	private async _getToken(): Promise<string | null> {
		const headers = {
			Accept: "*/*",
			"Content-Type": "application/x-www-form-urlencoded",
		};
		const body = querystring.stringify({
			grant_type: "client_credentials",
			client_id: this._id,
			client_secret: this._secret,
		});
		const reqOptions = {
			url: "https://api.intra.42.fr/oauth/token",
			method: "POST",
			headers: headers,
			data: body,
		};

		try {
			const res = await axios.request(reqOptions);
			return <string>res.data.access_token;
		} catch (err) {
			console.error(err);
		}
		return null;
	}

	async get(path: string): Promise<AxiosResponse<any, any> | null> {
		if (this._token === null) this._token = await this._getToken();
		for (let stop = 2; stop !== 0; stop--) {
			const config = {
				headers: {
					Authorization: "Bearer " + this._token,
				},
			};
			try {
				const res = await limiter.schedule(() =>
					axios.get(Client.uri + path, config)
				);
				return res;
			} catch (err: any) {
				console.error(err.response.statusText, err.response.config.url);
				this._token = await this._getToken();
				console.log("New token generated!");
			}
		}
		return null;
	}

	async fetch(path: string, limit: number = 0): Promise<Object[]> {
		const pages: Object[] | null = [];
		let page: Object[] = [];
		let res: AxiosResponse<any, any> | null;
		const bar: Loader = new Loader(24);
		const size: number = limit < 100 && limit > 0 ? limit : 100;
		bar.start();
		try {
			for (let i = 1; page?.length || i === 1; i++) {
				pages.push(...page);
				res = await this.get(path + `&page[size]=${size}&page[number]=` + i);
				if (res === null) throw "Error in Client.fetch";
				page = res.data;
				const total: number = limit || Number(res.headers["x-total"]);
				bar.step(`Fetching pages`, pages.length, total);
				if (limit && pages.length >= limit) {
					bar.end();
					return pages.slice(0, limit);
				}
			}
		} catch (err) {
			console.error(err);
		}
		bar.end();
		return pages;
	}
}
