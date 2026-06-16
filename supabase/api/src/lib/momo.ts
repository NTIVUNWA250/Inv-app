import crypto from "crypto"
import { env } from "../env.js"
import { access } from "fs";

interface MoMoTransferPayload {
    amount: string;
    currency: string;
    externalId: string;
    payee: {
        partyIdType: "MSISDN";
        partyId: string;
    };
    payerMessage?: string;
    payeeNote?: string;
}

export interface MoMoTransferStatusResponse {
    financialTransactionId?: string;
    status: "PENDING" | "SUCCESSFUL" | "FAILED";
    reason?: {
        code: string;
        message: string;
    };
}

export class MoMoClient {
    private subscriptionKey: string;
    private apiUser: string;
    private apiKey: string;
    private targetEnv: string;
    private baseUrl = "https://sandbox.momodeveloper.mtn.com";
    private isMock = false;

    constructor() {
        this.subscriptionKey = env.momoSubscriptionKey;
        this.apiUser = env.momoApiUser;
        this.apiKey = env.momoApiKey;
        this.targetEnv = env.momoTargetEnv;

        if (!this.subscriptionKey) {
            console.warn("[MTN MoMo] No MOMO_SUBSCRIPTION_KEY found. Running in MOCK mode")
            this.isMock = true;
        }
    }
    async provisionSandbox(): Promise<void> {
        if (this.isMock) return
        if (this.apiUser && this.apiKey) return;

        try {
            console.log("[MTN MoMo] Provisioning Sandbox API User...")
            const uuid = crypto.randomUUID()

            const createRes = await fetch(`${this.baseUrl}/v1_0/apiuser`, {
                method: "POST",
                headers: {
                    "Content-Type": "application.json",
                    "X-Reference-Id": uuid,
                    "Ocp-Apim-Subscription-Key": this.subscriptionKey,
                },
                body: JSON.stringify({ providerCallbackHost: "localhost", })
            })

            if (!createRes.ok) {
                throw new Error(`Failed to create apiuser: status ${createRes.status}`)
            }

            console.log("[MTN MoMo] Generating Sandbox API Key...")
            const keyRes = await fetch(`${this.baseUrl}/v1_0/apiuser/${uuid}/apikey`, {
                method: "POST",
                headers: {
                    "Ocp-Apim-Subscription-Key": this.subscriptionKey,
                }
            })

            if (!keyRes.ok) {
                throw new Error(`Failed to generate apiKey: status ${keyRes.status}`)
            }

            const { apiKey } = (await keyRes.json()) as { apiKey: string };
            this.apiUser = uuid;
            this.apiKey = apiKey;
            console.log(`Provisioned Sandbox: USER = ${uuid}, KEY = ${apiKey}`)
            console.log("Please save these in your .env as MOMO_API_USER and MOMO_API_KEY")
        } catch (err) {
            console.error("[MTN MoMo] Provision Failed, falling back to mock mode:", err)
            this.isMock = true;

        }
    }

    private async getAccessToken(): Promise<string> {
        if (this.isMock) return "mock-token";
        await this.provisionSandbox()

        const auth = Buffer.from(`${this.apiUser}: ${this.apiKey}`).toString("base64");
        const res = await fetch(`${this.baseUrl}/disbursement/token/`, {
            method: "POST",
            headers: {
                Authorization: `Basic ${auth}`,
                "Ocp-Apim-Subscription-Key": this.subscriptionKey,
            },
        })

        if (!res.ok) {
            throw new Error(`Could not fetch OAuth token: status ${res.status}`)
        }

        const { access_token } = (await res.json()) as {
            access_token: string;
        }
        return access_token;
    }
}