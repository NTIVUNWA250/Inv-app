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
                    "Content-Type": "application/json",
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

        const auth = Buffer.from(`${this.apiUser}:${this.apiKey}`).toString("base64");
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
    async transfer(phone: string, amount: number, externalId: string): Promise<string> {
        const momoRef = crypto.randomUUID();

        if (this.isMock) {
            console.log(`[MTN MoMo Mock] Simulating transfer of RWF ${amount} to ${phone} (Ref: ${momoRef})`);
            return momoRef;
        }

        const token = await this.getAccessToken();

        const payload: MoMoTransferPayload = {
            amount: amount.toString(),
            currency: "EUR",
            externalId,
            payee: {
                partyIdType: "MSISDN",
                partyId: phone,
            },
            payerMessage: "Corporate Expense",
            payeeNote: "Inventory Purchase",
        }

        const res = await fetch(`${this.baseUrl}/disbursement/v1_0/transfer`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "X-Reference-Id": momoRef,
                "X-Target-Environment": this.targetEnv,
                "Ocp-Apim-Subscription-Key": this.subscriptionKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (res.status !== 202) { throw new Error(`MoMo tranfer request rejected: status ${res.status}`) }
        return momoRef
    }

    async getTransferStatus(momoRef: string): Promise<MoMoTransferStatusResponse> {
        if (this.isMock) {
            return { status: "SUCCESSFUL" }
        }

        const token = await this.getAccessToken()

        const res = await fetch(`${this.baseUrl}/disbursement/v1_0/transfer/${momoRef}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "X-Target-Environment": this.targetEnv,
                "Ocp-Apim-Subscription-Key": this.subscriptionKey,
            },
        });

        if (!res.ok) {
            throw new Error(`Failed to query tranfer status: ${res.status}`);
        }
        return (await res.json()) as MoMoTransferStatusResponse;
    }

    private async getCollectionAccessToken(): Promise<string> {
        if (this.isMock) return "mock-token";
        await this.provisionSandbox()

        const auth = Buffer.from(`${this.apiUser}:${this.apiKey}`).toString("base64");
        const res = await fetch(`${this.baseUrl}/collection/token/`, {
            method: "POST",
            headers: {
                Authorization: `Basic ${auth}`,
                "Ocp-Apim-Subscription-Key": this.subscriptionKey,
            },
        })

        if (!res.ok) {
            throw new Error(`Could not fetch OAuth Collection token: status ${res.status}`)
        }

        const { access_token } = (await res.json()) as {
            access_token: string;
        }
        return access_token;
    }

    async requestToPay(phone: string, amount: number, externalId: string): Promise<string> {
        const momoRef = crypto.randomUUID();

        if (this.isMock) {
            console.log(`[MTN MoMo Mock] Simulating Request to Pay (USSD push) of RWF ${amount} to ${phone} (Ref: ${momoRef})`);
            return momoRef;
        }

        try {
            const token = await this.getCollectionAccessToken();

            const payload = {
                amount: amount.toString(),
                currency: "EUR",
                externalId,
                payer: {
                    partyIdType: "MSISDN",
                    partyId: phone,
                },
                payerMessage: "Corporate Purchase",
                payeeNote: "Inventory Purchase",
            }

            console.log(`[MTN MoMo] Requesting payment from ${phone} via Collections...`)
            const res = await fetch(`${this.baseUrl}/collection/v1_0/requesttopay`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "X-Reference-Id": momoRef,
                    "X-Target-Environment": this.targetEnv,
                    "Ocp-Apim-Subscription-Key": this.subscriptionKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (res.status !== 202) { 
                console.warn(`[MTN MoMo] Collections Request rejected with status ${res.status}. Falling back to mock simulation.`);
                return momoRef;
            }
            return momoRef
        } catch (err) {
            console.error("[MTN MoMo] Collections API error, falling back to mock:", err);
            return momoRef;
        }
    }

    async getCollectionStatus(momoRef: string): Promise<MoMoTransferStatusResponse> {
        if (this.isMock) {
            return { status: "SUCCESSFUL" }
        }

        try {
            const token = await this.getCollectionAccessToken()

            const res = await fetch(`${this.baseUrl}/collection/v1_0/requesttopay/${momoRef}`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "X-Target-Environment": this.targetEnv,
                    "Ocp-Apim-Subscription-Key": this.subscriptionKey,
                },
            });

            if (!res.ok) {
                throw new Error(`Failed to query collection status: ${res.status}`);
            }
            return (await res.json()) as MoMoTransferStatusResponse;
        } catch (err) {
            console.error("[MTN MoMo] Error querying collection status, returning SUCCESSFUL mock simulation:", err);
            return { status: "SUCCESSFUL" };
        }
    }
}

export const momo = new MoMoClient()