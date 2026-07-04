"use client";

import { useEffect, useState } from "react";
import { isAddress } from "ethers";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { TransactionStatus, type TransactionState } from "@/components/TransactionStatus";
import { useWallet } from "@/hooks/useWallet";
import { getIdentitySource, getIdentitySourceLabel } from "@/lib/arcNative";
import { createLocalResourceId } from "@/lib/localResources";
import { getLegacyParticipantType, isEntityType, isUserType } from "@/lib/participants";
import { isValidUsdcAmount } from "@/lib/validateUsdcAmount";
import { normalizeWeb3Error } from "@/lib/web3";
import {
  licenseValues,
  entityTypeValues,
  resourceTypeValues,
  userTypeValues,
  type InstantResource,
  type ResourceFile
} from "@/types/resource";
import type { PublishResourceFormValues } from "@/types/task";

export default function PublishResourcePage() {
  const router = useRouter();
  const { address } = useWallet();
  const [txState, setTxState] = useState<TransactionState>({ phase: "idle" });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { register, handleSubmit, setValue, watch } = useForm<PublishResourceFormValues>({
    defaultValues: {
      title: "",
      description: "",
      budgetUsdc: "",
      sellerAddress: "",
      category: "",
      tags: "",
      license: "Commercial Use Allowed",
      resourceType: "Software Development",
      agentConsumable: true,
      previewText: "",
      lockedContent: "",
      unlockedContentMock: "",
      deliveryType: "inline",
      requirements: "",
      deadline: "",
      userType: "",
      entityType: "INDIVIDUAL",
      participantType: "human",
      participantName: "",
      operatorAddress: "",
      arcIdentityId: ""
    }
  });
  const selectedUserType = watch("userType");
  const isTxBusy = ["signature", "submitted", "confirming"].includes(txState.phase);

  useEffect(() => {
    if (address) {
      setValue("sellerAddress", address);
    }
  }, [address, setValue]);

  const onSubmit = async (values: PublishResourceFormValues) => {
    if (!isValidUsdcAmount(values.budgetUsdc)) {
      setTxState({
        phase: "error",
        message: "Enter a valid positive USDC price."
      });
      return;
    }

    const sellerAddress = values.sellerAddress || address || "";

    if (!isAddress(sellerAddress)) {
      setTxState({
        phase: "error",
        message: "Enter a valid seller wallet address before publishing."
      });
      return;
    }

    const operatorAddress = values.operatorAddress.trim();

    if (operatorAddress && !isAddress(operatorAddress)) {
      setTxState({
        phase: "error",
        message: "Enter a valid operator wallet address or leave it blank."
      });
      return;
    }

    if (!values.title.trim() || !values.description.trim() || !values.budgetUsdc.trim()) {
      setTxState({
        phase: "error",
        message: "Title, description, and price are required."
      });
      return;
    }

    try {
      const deliveryType = (values.deliveryType === "download" ? "download" : "inline") as
        | "download"
        | "inline";
      const resourceId = createLocalResourceId(values.title);
      let uploadedFiles: ResourceFile[] = [];

      if (deliveryType === "download") {
        if (selectedFiles.length === 0) {
          setTxState({
            phase: "error",
            message: "Attach at least one downloadable file before publishing."
          });
          return;
        }

        setTxState({ phase: "submitted", message: "Uploading files to private storage." });
        const formData = new FormData();
        formData.append("resourceId", resourceId);
        selectedFiles.forEach((file) => formData.append("files", file));

        const uploadResponse = await fetch("/api/resources/upload", {
          method: "POST",
          body: formData
        });
        const uploadBody = (await uploadResponse.json()) as {
          files?: ResourceFile[];
          message?: string;
          error?: string;
        };

        if (!uploadResponse.ok || !uploadBody.files) {
          throw new Error(uploadBody.message || uploadBody.error || "File upload failed.");
        }

        uploadedFiles = uploadBody.files;
      }

      setTxState({ phase: "confirming", message: "Publishing resource metadata." });
      const resource: InstantResource = {
        id: resourceId,
        title: values.title.trim(),
        description: values.description.trim(),
        resourceType: values.resourceType as InstantResource["resourceType"],
        category: values.category.trim() || "Uncategorized",
        tags: values.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        priceUSDC: values.budgetUsdc.trim(),
        license: values.license as InstantResource["license"],
        accessType: "instant",
        deliveryType,
        sellerName: values.participantName.trim() || undefined,
        userType: isUserType(values.userType) ? values.userType : undefined,
        entityType: isEntityType(values.entityType) ? values.entityType : "INDIVIDUAL",
        participantType: isUserType(values.userType)
          ? getLegacyParticipantType(values.userType)
          : undefined,
        participantName: values.participantName.trim() || undefined,
        operatorAddress: operatorAddress || undefined,
        arcIdentityId: values.arcIdentityId.trim() || undefined,
        identitySource: getIdentitySource(values.arcIdentityId.trim() || undefined),
        sellerAddress,
        lockedContentURI: values.lockedContent.trim() || "local://browser-only-resource",
        previewText: values.previewText.trim() || values.description.trim(),
        agentConsumable: values.agentConsumable,
        unlockedContentMock:
          values.unlockedContentMock.trim() ||
          (deliveryType === "inline"
            ? "# Resource payload\n\nAdd the unlocked Markdown or JSON content here."
            : undefined),
        files: uploadedFiles
      };

      const publishResponse = await fetch("/api/resources/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resource)
      });
      const publishBody = (await publishResponse.json()) as {
        resource?: InstantResource;
        message?: string;
        error?: string;
      };

      if (!publishResponse.ok || !publishBody.resource) {
        throw new Error(publishBody.message || publishBody.error || "Resource publish failed.");
      }

      setTxState({
        phase: "success",
        message: "Instant Resource published. Redirecting to the resource detail."
      });
      router.push(`/marketplace/${resourceId}`);
    } catch (error) {
      setTxState({ phase: "error", message: normalizeWeb3Error(error) });
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Publish"
        title="Publish Resource"
        description="Publish an Instant Access knowledge asset for buyers and agents to unlock with USDC."
      />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid min-w-0 gap-5 rounded-lg border border-arc-border bg-arc-panel/80 p-5 shadow-glow lg:grid-cols-2"
      >
        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-medium text-slate-200">Title</span>
          <input
            {...register("title")}
            className="w-full min-w-0 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="Create an agent procurement policy"
          />
        </label>

        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-medium text-slate-200">Price in USDC</span>
          <input
            {...register("budgetUsdc")}
            className="w-full min-w-0 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="0.75"
            inputMode="decimal"
          />
        </label>

        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-medium text-slate-200">Resource type</span>
          <select
            {...register("resourceType")}
            className="w-full min-w-0 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition focus:border-arc-blue"
          >
            {resourceTypeValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-medium text-slate-200">License</span>
          <select
            {...register("license")}
            className="w-full min-w-0 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition focus:border-arc-blue"
          >
            {licenseValues.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-medium text-slate-200">Category</span>
          <input
            {...register("category")}
            className="w-full min-w-0 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="Agentic Commerce"
          />
        </label>

        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-medium text-slate-200">Tags</span>
          <input
            {...register("tags")}
            className="w-full min-w-0 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="Agents, Procurement, USDC"
          />
        </label>

        <label className="grid min-w-0 gap-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-200">Seller address</span>
          <input
            {...register("sellerAddress")}
            className="w-full min-w-0 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="0x..."
          />
        </label>

        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-medium text-slate-200">User Type</span>
          <select
            {...register("userType")}
            className="w-full min-w-0 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition focus:border-arc-blue"
          >
            <option value="">Not declared</option>
            {userTypeValues.map((value) => (
              <option key={value} value={value}>
                {value === "AGENT" ? "Agent" : "Human"}
              </option>
            ))}
          </select>
          {selectedUserType === "AGENT" ? (
            <span className="text-xs leading-5 text-slate-500">
              Use this when an autonomous agent or agent-controlled service is selling this
              resource.
            </span>
          ) : null}
        </label>

        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-medium text-slate-200">Entity Type</span>
          <select
            {...register("entityType")}
            className="w-full min-w-0 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition focus:border-arc-blue"
          >
            {entityTypeValues.map((value) => (
              <option key={value} value={value}>
                {value === "INDIVIDUAL"
                  ? "Individual"
                  : value === "BUSINESS"
                    ? "Business"
                    : "Organization"}
              </option>
            ))}
          </select>
        </label>

        <label className="grid min-w-0 gap-2">
          <span className="text-sm font-medium text-slate-200">Seller Display Name</span>
          <input
            {...register("participantName")}
            className="w-full min-w-0 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="ResearchAgent-01"
          />
        </label>

        <label className="grid min-w-0 gap-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-200">Operator Wallet (optional)</span>
          <input
            {...register("operatorAddress")}
            className="w-full min-w-0 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="0x..."
          />
          <span className="text-xs leading-5 text-slate-500">
            Self-declared metadata only. This does not verify identity or wallet ownership.
          </span>
        </label>

        <label className="grid min-w-0 gap-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-200">Arc Identity ID (optional)</span>
          <input
            {...register("arcIdentityId")}
            className="w-full min-w-0 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="Arc Identity reference, if available"
          />
          <span className="text-xs leading-5 text-slate-500">
            Identity Source:{" "}
            {getIdentitySourceLabel(getIdentitySource(watch("arcIdentityId") || undefined))}.
          </span>
        </label>

        <label className="grid min-w-0 gap-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-200">Preview text</span>
          <input
            {...register("previewText")}
            className="w-full min-w-0 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="Short public preview shown before purchase."
          />
        </label>

        <div className="grid gap-3 rounded-lg border border-arc-border bg-black/20 p-4 lg:col-span-2">
          <span className="text-sm font-medium text-slate-200">Delivery mode</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-lg border border-arc-border bg-black/20 p-3">
              <input
                {...register("deliveryType")}
                type="radio"
                value="inline"
                className="size-4"
                defaultChecked
              />
              <span>
                <span className="block text-sm font-semibold text-white">Inline Content</span>
                <span className="text-xs text-slate-500">Markdown or JSON shown after purchase.</span>
              </span>
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-arc-border bg-black/20 p-3">
              <input {...register("deliveryType")} type="radio" value="download" className="size-4" />
              <span>
                <span className="block text-sm font-semibold text-white">Downloadable Files</span>
                <span className="text-xs text-slate-500">Private files unlocked after payment proof.</span>
              </span>
            </label>
          </div>
        </div>

        <label className="grid min-w-0 gap-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-200">Locked content reference</span>
          <input
            {...register("lockedContent")}
            className="w-full min-w-0 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="content://private-resource-reference"
          />
        </label>

        <label className="grid min-w-0 gap-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-200">Unlocked content preview</span>
          <textarea
            {...register("unlockedContentMock")}
            className="min-h-32 w-full min-w-0 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="# Resource payload&#10;&#10;Paste the JSON or Markdown content unlocked after purchase."
          />
        </label>

        <div className="grid gap-3 rounded-lg border border-arc-border bg-black/20 p-4 lg:col-span-2">
          <label className="grid min-w-0 gap-2">
            <span className="text-sm font-medium text-slate-200">Downloadable files</span>
            <input
              type="file"
              multiple
              accept=".csv,.json,.yaml,.yml,.md,.txt,.pdf,.zip,.parquet,.ipynb,.py"
              onChange={(event) => {
                setSelectedFiles(Array.from(event.target.files ?? []).slice(0, 10));
              }}
              className="w-full min-w-0 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-arc-blue file:px-3 file:py-2 file:text-sm file:font-semibold file:text-arc-ink"
            />
          </label>
          {selectedFiles.length > 0 ? (
            <div className="grid min-w-0 gap-2">
              {selectedFiles.map((file) => (
                <div
                  key={`${file.name}-${file.size}`}
                  className="flex min-w-0 flex-col gap-2 rounded-lg border border-arc-border bg-black/20 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0 break-all text-white">{file.name}</span>
                  <span className="text-slate-500">
                    {file.type || "application/octet-stream"} - {(file.size / 1024).toFixed(1)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedFiles((files) => files.filter((item) => item !== file))
                    }
                    className="text-left text-sm font-semibold text-red-200 hover:text-white"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Allowed: CSV, JSON, YAML, Markdown, TXT, PDF, ZIP, Parquet, IPYNB, and Python files.
              Max 10 files, 10 MB each.
            </p>
          )}
        </div>

        <label className="flex items-center gap-3 lg:col-span-2">
          <input
            {...register("agentConsumable")}
            type="checkbox"
            className="size-4 rounded border-arc-border bg-black/30"
          />
          <span className="text-sm font-medium text-slate-200">Agent-consumable metadata</span>
        </label>

        <label className="grid min-w-0 gap-2 lg:col-span-2">
          <span className="text-sm font-medium text-slate-200">Description</span>
          <textarea
            {...register("description")}
            className="min-h-40 w-full min-w-0 rounded-lg border border-arc-border bg-black/30 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-arc-blue"
            placeholder="Describe the knowledge asset, intended audience, expected format, and acceptance criteria."
          />
        </label>

        <div className="lg:col-span-2">
          <button
            type="submit"
            disabled={isTxBusy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-arc-mint px-5 py-3 text-sm font-semibold text-arc-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isTxBusy ? <LoadingSpinner /> : null}
            {isTxBusy ? "Saving resource..." : "Save instant resource draft"}
          </button>
        </div>
      </form>

      <div className="mt-5 grid gap-3">
        <TransactionStatus state={txState} />
      </div>
    </PageShell>
  );
}
