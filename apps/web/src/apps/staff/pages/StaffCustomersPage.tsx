import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../../shared/services/api.client";
import { useAuth } from "../../../shared/hooks/useAuth";
import { AadhaarUploadFields } from "../../../shared/components/AadhaarUploadFields";
import { Modal, Notice, Page, QueryState } from "../../../shared/components/ui";

const empty = {
  name: "",
  phone: "",
  password: "",
  nomineeName: "",
  relationship: "",
  nomineePhone: "",
  aadhaarFrontKey: "",
  aadhaarBackKey: "",
};

export function StaffCustomersPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(
    params.get("action") === "create",
  );
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const customers = useQuery({
    queryKey: ["staff-customers", search],
    queryFn: () =>
      api<any[]>(`/staff/customers?search=${encodeURIComponent(search)}`),
  });
  const create = useMutation({
    mutationFn: () =>
      api("/staff/customers", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          password: form.password,
          aadhaar:
            form.aadhaarFrontKey || form.aadhaarBackKey
              ? {
                  frontKey: form.aadhaarFrontKey || undefined,
                  backKey: form.aadhaarBackKey || undefined,
                }
              : undefined,
          nominee: form.nomineeName
            ? {
                name: form.nomineeName,
                relationship: form.relationship,
                phone: form.nomineePhone || undefined,
              }
            : undefined,
        }),
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setForm(empty);
      setMessage("Customer created.");
      await queryClient.invalidateQueries({ queryKey: ["staff-customers"] });
    },
    onError: (requestError) =>
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Unable to create customer.",
      ),
  });
  const canCreate = session?.permissions.includes("canCreateCustomer");

  return (
    <Page
      title="Customers"
      subtitle={
        params.get("action") === "enroll"
          ? "Select a customer to open details and enroll a scheme."
          : "Search and open a customer account."
      }
      actions={
        canCreate ? (
          <button
            className="primary"
            onClick={() => {
              setError("");
              setForm(empty);
              setCreateOpen(true);
            }}
          >
            <Plus /> New
          </button>
        ) : undefined
      }
    >
      <Notice>{message}</Notice>
      <div className="staff-list-stack">
        <div className="mobile-search">
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, phone or customer ID"
          />
        </div>
        <div className="section-heading">
          <div>
            <span>Customer directory</span>
            <h2>All customers</h2>
          </div>
          <small>{customers.data?.length ?? 0} records</small>
        </div>
        <QueryState
          loading={customers.isLoading}
          error={customers.error}
          empty={!customers.isLoading && !customers.data?.length}
          retry={() => void customers.refetch()}
        >
          <div className="passbook-ledger">
            {customers.data?.map((customer) => (
              <button
                key={customer._id}
                type="button"
                className="passbook-entry directory-entry"
                onClick={() => navigate(`/staff/customers/${customer._id}`)}
              >
                <div className="passbook-entry-top">
                  <span className="directory-avatar" aria-hidden="true">
                    <UserRound />
                  </span>
                  <div className="passbook-entry-copy">
                    <b>{customer.userId?.name}</b>
                    <small>
                      {customer.customerCode}
                      <span aria-hidden="true">·</span>
                      <Phone />
                      {customer.userId?.phone}
                    </small>
                  </div>
                  <span className="verified-customer">
                    <ShieldCheck /> Verified
                  </span>
                </div>
                <div className="passbook-entry-footer">
                  <em className="cash">Open customer account</em>
                  <span>
                    View
                    <ChevronRight />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </QueryState>
      </div>
      <Modal
        title="Create customer"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      >
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="form-grid">
            {[
              ["name", "Name"],
              ["phone", "Phone"],
              ["password", "Temporary password"],
              ["nomineeName", "Nominee name"],
              ["relationship", "Relationship"],
              ["nomineePhone", "Nominee phone"],
            ].map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  className="form-control"
                  type={key === "password" ? "password" : "text"}
                  minLength={key === "password" ? 10 : undefined}
                  required={["name", "phone", "password"].includes(key)}
                  value={(form as any)[key]}
                  onChange={(event) =>
                    setForm({ ...form, [key]: event.target.value })
                  }
                />
              </label>
            ))}
            <label>
              <span>Passbook ID</span>
              <input
                className="form-control"
                value="Auto-generated (000001…)"
                disabled
                readOnly
              />
            </label>
            <AadhaarUploadFields
              frontKey={form.aadhaarFrontKey || undefined}
              backKey={form.aadhaarBackKey || undefined}
              disabled={create.isPending}
              onChange={({ frontKey, backKey }) =>
                setForm({
                  ...form,
                  aadhaarFrontKey: frontKey ?? "",
                  aadhaarBackKey: backKey ?? "",
                })
              }
            />
          </div>
          <Notice error>{error}</Notice>
          <button className="primary wide-action" disabled={create.isPending}>
            Create customer
          </button>
        </form>
      </Modal>
    </Page>
  );
}
