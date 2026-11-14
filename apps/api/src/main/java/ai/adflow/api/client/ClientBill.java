package ai.adflow.api.client;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 계약 월 하나의 청구 (회계 문서 7절). 팀장만 보고 고친다. 날짜는 YYYY-MM-DD 문자열이다. */
@Entity
@Table(name = "client_bills")
public class ClientBill {

  @Id private String id;

  @Column(name = "client_id", nullable = false)
  private String clientId;

  @Column(name = "workspace_id", nullable = false)
  private String workspaceId;

  /** 몇 번째 계약 월인지 (1부터). */
  @Column(name = "contract_month", nullable = false)
  private Integer contractMonth;

  @Column(name = "bill_date")
  private String billDate;

  private Long amount;
  private Long discount;

  @Column(name = "due_date")
  private String dueDate;

  @Column(name = "paid_date")
  private String paidDate;

  @Column(name = "tax_invoice_no")
  private String taxInvoiceNo;

  public String getId() { return id; }
  public void setId(String v) { this.id = v; }
  public String getClientId() { return clientId; }
  public void setClientId(String v) { this.clientId = v; }
  public String getWorkspaceId() { return workspaceId; }
  public void setWorkspaceId(String v) { this.workspaceId = v; }
  public Integer getContractMonth() { return contractMonth; }
  public void setContractMonth(Integer v) { this.contractMonth = v; }
  public String getBillDate() { return billDate; }
  public void setBillDate(String v) { this.billDate = v; }
  public Long getAmount() { return amount; }
  public void setAmount(Long v) { this.amount = v; }
  public Long getDiscount() { return discount; }
  public void setDiscount(Long v) { this.discount = v; }
  public String getDueDate() { return dueDate; }
  public void setDueDate(String v) { this.dueDate = v; }
  public String getPaidDate() { return paidDate; }
  public void setPaidDate(String v) { this.paidDate = v; }
  public String getTaxInvoiceNo() { return taxInvoiceNo; }
  public void setTaxInvoiceNo(String v) { this.taxInvoiceNo = v; }
}
