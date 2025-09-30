import { Client, Account, Databases, Query } from "appwrite";
import { encode } from "ngeohash";
import type { UserProfile } from "../types/users";

export interface AppwriteConfig {
  endpoint: string;
  projectId: string;
  databaseId: string;
}

export interface DisasterDocument {
  $id: string;
  disaster_id: string;
  geohash: string;
  submitted_time: number;
  status: string;
  [key: string]: unknown;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
}

export interface AIMatrixDocument {
  $id: string;
  disaster_id: string;
  [key: string]: unknown;
}

export interface ResourceDocument {
  $id: string;
  disaster_id: string;
  availability: number;
  [key: string]: unknown;
}

export interface TaskDocument {
  $id: string;
  disaster_id: string;
  task_id: string;
  [key: string]: unknown;
}

export type UserProfileWithGeohash = UserProfile & { geohash: string };

export interface Message {
  $id: string;
  user: string;
  content: string;
  timestamp: string;
  avatar?: string;
  report_id?: string;
}

export class AppwriteService {
  private client: Client;
  private account: Account;
  private databases: Databases;
  private endpoint: string;
  private projectId: string;
  private databaseId: string;

  // Collection IDs from environment variables
  public readonly usersCollectionId: string;
  public readonly disastersCollectionId: string;
  public readonly aiMatrixCollectionId: string;
  public readonly tasksCollectionId: string;
  public readonly userRequestsCollectionId: string;
  public readonly resourcesCollectionId: string;

  constructor() {
    this.endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
    this.projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
    this.databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;

    // Collection IDs from environment variables
    this.usersCollectionId = import.meta.env.VITE_APPWRITE_USERS_COLLECTION_ID;
    this.disastersCollectionId =
      import.meta.env.VITE_APPWRITE_DISASTERS_COLLECTION_ID;
    this.aiMatrixCollectionId =
      import.meta.env.VITE_APPWRITE_AI_MATRIX_COLLECTION_ID;
    this.tasksCollectionId = import.meta.env.VITE_APPWRITE_TASKS_COLLECTION_ID;
    this.userRequestsCollectionId =
      import.meta.env.VITE_APPWRITE_USER_REQUESTS_COLLECTION_ID;
    this.resourcesCollectionId =
      import.meta.env.VITE_APPWRITE_RESOURCES_COLLECTION_ID;

    // Validate required environment variables
    const requiredVars = [
      { name: "VITE_APPWRITE_PROJECT_ID", value: this.projectId },
      { name: "VITE_APPWRITE_ENDPOINT", value: this.endpoint },
      { name: "VITE_APPWRITE_DATABASE_ID", value: this.databaseId },
      {
        name: "VITE_APPWRITE_USERS_COLLECTION_ID",
        value: this.usersCollectionId,
      },
      {
        name: "VITE_APPWRITE_DISASTERS_COLLECTION_ID",
        value: this.disastersCollectionId,
      },
      {
        name: "VITE_APPWRITE_AI_MATRIX_COLLECTION_ID",
        value: this.aiMatrixCollectionId,
      },
      {
        name: "VITE_APPWRITE_TASKS_COLLECTION_ID",
        value: this.tasksCollectionId,
      },
      {
        name: "VITE_APPWRITE_USER_REQUESTS_COLLECTION_ID",
        value: this.userRequestsCollectionId,
      },
      {
        name: "VITE_APPWRITE_RESOURCES_COLLECTION_ID",
        value: this.resourcesCollectionId,
      },
    ];

    const missingVars = requiredVars.filter((v) => !v.value).map((v) => v.name);
    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(", ")}`,
      );
    }

    // Initialize Appwrite client
    this.client = new Client();

    // Configure client
    this.client.setEndpoint(this.endpoint).setProject(this.projectId);

    // Initialize services
    this.account = new Account(this.client);
    this.databases = new Databases(this.client);
  }

  // Existing methods
  async getDocument(collectionId: string, documentId: string) {
    return this.databases.getDocument(
      this.databaseId,
      collectionId,
      documentId,
    );
  }

  async updateDocument(collectionId: string, documentId: string, data: object) {
    return this.databases.updateDocument(
      this.databaseId,
      collectionId,
      documentId,
      data,
    );
  }

  async getUser() {
    return this.account.get();
  }

  /**
   * Get AI Matrix by disaster ID
   */
  async getAIMatrixByDisasterId(
    disasterId: string,
  ): Promise<AIMatrixDocument | null> {
    try {
      const document = await this.databases.getDocument(
        this.databaseId,
        this.aiMatrixCollectionId,
        `matrix_${disasterId}`,
      );
      return document as unknown as AIMatrixDocument;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 404
      ) {
        return null;
      }
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to get AI matrix: ${errorMessage}`);
    }
  }

  /**
   * Get all disasters
   */
  async getAllDisasters(): Promise<DisasterDocument[]> {
    try {
      const response = await this.databases.listDocuments(
        this.databaseId,
        this.disastersCollectionId,
        [Query.limit(100)], // Add limit to 100
      );
      console.log("Fetched disasters:", response.documents); // Log fetched disasters
      return response.documents as unknown as DisasterDocument[];
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to get all disasters: ${errorMessage}`);
    }
  }

  /**
   * Get disaster details by ID
   */
  async getDisasterById(disasterId: string): Promise<DisasterDocument | null> {
    try {
      const document = await this.databases.getDocument(
        this.databaseId,
        this.disastersCollectionId,
        disasterId,
      );
      return document as unknown as DisasterDocument;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 404
      ) {
        return null;
      }
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to get disaster: ${errorMessage}`);
    }
  }

  /**
   * Get all resources by disaster ID
   */
  async getResourcesByDisasterId(
    disasterId: string,
  ): Promise<ResourceDocument[]> {
    try {
      const response = await this.databases.listDocuments(
        this.databaseId,
        this.resourcesCollectionId,
        [Query.equal("disaster_id", disasterId), Query.limit(100)], // Add limit to 100
      );
      return response.documents as unknown as ResourceDocument[];
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to get resources: ${errorMessage}`);
    }
  }

  /**
   * Get all tasks by disaster ID
   */
  async getTasksByDisasterId(disasterId: string): Promise<TaskDocument[]> {
    try {
      const response = await this.databases.listDocuments(
        this.databaseId,
        this.tasksCollectionId,
        [Query.equal("disaster_id", disasterId), Query.limit(100)], // Add limit to 100
      );
      return response.documents as unknown as TaskDocument[];
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to get tasks: ${errorMessage}`);
    }
  }

  /**
   * Find nearby disasters within a week
   */
  async getNearbyDisasters(
    latitude: number,
    longitude: number,
  ): Promise<DisasterDocument[]> {
    const EXCLUDED_KEYS = new Set([
      "gdac_disasters",
      "cnn_analysis",
      "weather_data",
      "citizen_survival_guide",
      "government_report",
    ]);

    const geohashPrefix = encode(latitude, longitude, 4);
    const oneWeekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

    console.log(
      `Querying disasters near geohash: ${geohashPrefix} from ${oneWeekAgo} seconds ago`,
    );

    try {
      const response = await this.databases.listDocuments(
        this.databaseId,
        this.disastersCollectionId,
        [
          Query.startsWith("geohash", geohashPrefix),
          Query.greaterThan("submitted_time", oneWeekAgo),
          Query.limit(100),
        ],
      );

      const results: DisasterDocument[] = [];

      for (const document of response.documents) {
        // Clean the document by removing excluded keys
        const cleaned: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(document)) {
          if (!EXCLUDED_KEYS.has(key)) {
            cleaned[key] = value;
          }
        }

        const submittedTime = cleaned.submitted_time;
        if (typeof submittedTime === "number" && submittedTime >= oneWeekAgo) {
          results.push(cleaned as DisasterDocument);
        }
      }

      return results;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`Error querying disasters: ${errorMessage}`);
      return [];
    }
  }
  /**
   * Get a user's latitude and longitude by user ID
   */
  async getUserLocation(
    userId: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const userDoc = await this.databases.getDocument(
        this.databaseId,
        this.usersCollectionId,
        userId,
      );

      const latitude = userDoc.latitude as number | undefined;
      const longitude = userDoc.longitude as number | undefined;

      if (latitude === undefined || longitude === undefined) {
        return null; // Location not set
      }

      return { latitude, longitude };
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 404
      ) {
        return null; // User not found
      }
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to get user location: ${errorMessage}`);
    }
  }
  /**
   * Get users (except government) by disaster geohash prefix (first 4 chars of disaster's geohash)
   */
  async getUsersByDisasterGeohash(
    disasterId: string,
  ): Promise<UserProfileWithGeohash[]> {
    // Get the disaster document
    const disaster = await this.getDisasterById(disasterId);
    if (!disaster || typeof disaster.geohash !== "string") {
      throw new Error("Disaster or geohash not found");
    }
    const geohashPrefix = disaster.geohash.slice(0, 4);
    // Query users whose geohash starts with this prefix and role != 'government'
    const response = await this.databases.listDocuments(
      this.databaseId,
      this.usersCollectionId,
      [
        Query.startsWith("geohash", geohashPrefix),
        Query.notEqual("role", "government"),
        Query.limit(100),
      ],
    );
    // Return user info (uid, name, role, skills, department, unit, position, status, phone, email, profile_image_url, latitude, longitude, geohash)
    return response.documents.map((user: unknown) => {
      const u = user as UserProfile & { geohash: string; created_at: string };
      return {
        uid: u.uid,
        name: u.name,
        role: u.role,
        skills: u.skills,
        department: u.department,
        unit: u.unit,
        position: u.position,
        status: u.status,
        phone: u.phone,
        email: u.email,
        profile_image_url: u.profile_image_url,
        latitude: u.latitude,
        longitude: u.longitude,
        geohash: u.geohash,
        created_at: u.created_at,
      };
    });
  }

  /**
   * Get chat messages (optionally by reportId)
   */
  async getMessages(reportId?: string | null): Promise<Message[]> {
    const collectionId = import.meta.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID;
    const queries = reportId
      ? [
          Query.equal("report_id", reportId),
          Query.orderAsc("timestamp"),
          Query.limit(100),
        ]
      : [
          Query.isNull("report_id"),
          Query.orderAsc("timestamp"),
          Query.limit(100),
        ];
    const response = await this.databases.listDocuments(
      this.databaseId,
      collectionId,
      queries,
    );
    return response.documents.map((doc: Record<string, unknown>) => ({
      $id: doc.$id as string,
      user: doc.user as string,
      content: doc.content as string,
      timestamp: doc.timestamp as string,
      avatar: doc.avatar as string | undefined,
      report_id: doc.report_id as string | undefined,
    }));
  }

  /**
   * Create a chat message
   */
  async createMessage(data: {
    user: string;
    content: string;
    timestamp: string;
    report_id?: string;
  }): Promise<Message> {
    const collectionId = import.meta.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID;
    const doc = await this.databases.createDocument(
      this.databaseId,
      collectionId,
      "unique()",
      data,
    );
    return {
      $id: doc.$id,
      user: doc.user,
      content: doc.content,
      timestamp: doc.timestamp,
      avatar: doc.avatar,
      report_id: doc.report_id,
    };
  }

  /**
   * Subscribe to real-time chat messages
   */
  subscribeToMessages(callback: (message: Message) => void): () => void {
    const collectionId = import.meta.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID;
    const databaseId = this.databaseId;
    const channel = `databases.${databaseId}.collections.${collectionId}.documents`;
    const unsubscribe = this.client.subscribe(
      channel,
      (response: { events: string[]; payload: Message }) => {
        if (
          response.events.includes(
            "databases.*.collections.*.documents.*.create",
          )
        ) {
          callback(response.payload);
        }
      },
    );
    return unsubscribe;
  }
}

export const appwriteService = new AppwriteService();
