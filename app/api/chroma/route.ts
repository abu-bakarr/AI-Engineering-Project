import { NextRequest, NextResponse } from "next/server";
import { CloudClient, Collection, Metadata } from "chromadb";

interface AddDataRequest {
  ids: string[];
  documents: string[];
  metadatas: Metadata[];
}

const chromaClient = new CloudClient({
  apiKey: process.env.CHROMA_API_KEY,
  ...(process.env.CHROMA_TENANT ? { tenant: process.env.CHROMA_TENANT } : {}),
  ...(process.env.CHROMA_DATABASE
    ? { database: process.env.CHROMA_DATABASE }
    : {}),
});

const collectionName = process.env.CHROMA_COLLECTION || "myCollection";

let myCollection: Collection | null = null;

const getMyCollection = async () => {
  if (!myCollection) {
    myCollection = await chromaClient.getOrCreateCollection({
      name: collectionName,
    });
  }
  return myCollection;
};

function isValidAddDataRequest(value: unknown): value is AddDataRequest {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<AddDataRequest>;
  return (
    Array.isArray(candidate.ids) &&
    Array.isArray(candidate.documents) &&
    Array.isArray(candidate.metadatas) &&
    candidate.ids.length > 0 &&
    candidate.ids.length === candidate.documents.length &&
    candidate.ids.length === candidate.metadatas.length
  );
}

export async function POST(request: NextRequest) {
  try {
    const data: unknown = await request.json();
    if (!isValidAddDataRequest(data)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid payload. Expect ids, documents, and metadatas arrays of the same length.",
        },
        { status: 400 },
      );
    }

    const collection = await getMyCollection();

    await collection.add({
      ids: data.ids,
      documents: data.documents,
      metadatas: data.metadatas,
    });

    return NextResponse.json({
      success: true,
      message: "Data added successfully",
      count: data.ids.length,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    console.error("Chroma add data failed:", details);
    return NextResponse.json(
      { success: false, message: "Failed to add data", details },
      { status: 500 },
    );
  }
}
