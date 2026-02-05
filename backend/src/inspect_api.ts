import * as humeConfigService from "./services/humeConfig";
import dotenv from "dotenv";

dotenv.config();

async function inspect() {
    console.log("🔍 Fetching Configs...");
    try {
        const response = await humeConfigService.listConfigs();
        // Handle paginated response which often has 'configs' array, or direct array
        const configs = Array.isArray(response) ? response : response?.configs_page || response?.configs || [];
        
        if (configs.length > 0) {
            console.log("✅ Found Valid Config. Structure:");
            console.log(JSON.stringify(configs[0], null, 2));
        } else {
            console.log("⚠️ No configs found on account.");
        }
    } catch (err: any) {
        console.error("❌ Error fetching configs:", err.message);
        if (err.details) console.error(err.details);
    }
}

inspect();
