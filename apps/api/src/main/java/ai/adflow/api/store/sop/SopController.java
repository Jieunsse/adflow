package ai.adflow.api.store.sop;

import ai.adflow.api.store.StoreController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/stores/sops")
public class SopController extends StoreController<Sop> {

  public SopController(SopRepository repository) {
    super(repository);
  }
}
